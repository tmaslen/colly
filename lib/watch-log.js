var AWS      = require( "aws-sdk" );
const fs     = require( "fs" );
const _      = require( "lodash" );
const chalk  = require( "chalk" );
const moment = require( "moment" );
var os       = require( "os");

const utils = require( "./utils" );

const projectConfig = utils.getProjectConfig();

AWS.config.region = projectConfig.region;

function getLogName() {

	if ( process.env.COLLY__LAMBDA_NAME ) {
		return `/aws/lambda/${utils.getLambdaName()}`;
	}

	throw new Error("Unable to determine which log group name to use.");
}

function getLogs() {

	return new Promise( ( resolve, reject ) => {

		const cloudwatchlogs = new AWS.CloudWatchLogs();

		const params = {
			"logGroupName": getLogName(),
			"descending":   true,
			"limit":        50,
			"orderBy":      "LastEventTime"
		};

		cloudwatchlogs.describeLogStreams( params, function( err, data ) {

			if ( err )  {

				reject( err );

			} else {

				if ( data.logStreams.length === 0 ) {
					reject( "No logs exist yet." );
				}

				resolve(
					_.chain( data.logStreams )
						// .filter( stream => stream.logStreamName.includes( "[$LATEST]" ) )
						.map( "logStreamName" )
						.value()
				);

			}

		});

	});

}

function formatLogEvent( msg ) {

	const dateFormat = "YYYY-MM-DD HH:mm:ss.SSS (Z)";

	if ( msg.startsWith( "REPORT" ) ) {
		msg += os.EOL;
	}

	if ( msg.startsWith( "START" ) || msg.startsWith( "END" ) || msg.startsWith( "REPORT" ) ) {

		return chalk.gray( msg );

	} else if ( msg.trim() === "Process exited before completing request" ) {

		return chalk.red(msg);

	}

	const splitted = msg.split( "\t" );

	if ( splitted.length < 3 || new Date( splitted[ 0 ] ) === "Invalid Date" ) {
		return msg;
	}

	const reqId = splitted[ 1 ];
	const time = chalk.green( moment( splitted[ 0 ] ).format( dateFormat ) );
	const text = msg.split( `${reqId}\t` )[ 1 ];

	return `${time}\t${chalk.yellow(reqId)}\t${text}\n\n`;

};

let startTime;

function showLogs( logStreamNames ) {
    
    return new Promise( ( resolve, reject ) => {

    	console.log( "Requesting logs..." );

    	console.log( "logStreamNames.length: " + logStreamNames.length );

		const cloudwatchlogs = new AWS.CloudWatchLogs();
		
		const params = {
			"logGroupName":   getLogName(),
			"interleaved":    true,
			"logStreamNames": logStreamNames
		};

		if ( process.env.COLLY__SEARCH ) {
			params.filterPattern = process.env.COLLY__SEARCH;
		}

		if ( process.env.COLLY__START_TIME ) {

			startTime = process.env.COLLY__START_TIME;

			const since = ( [ "m", "h", "d" ].indexOf( startTime[ startTime.length - 1 ] ) !== -1 );

			if ( since ) {

				params.startTime = moment().subtract(
					startTime.replace( /\D/g, ""),
					startTime.replace( /\d/g, "")
				).valueOf();

			} else {

				params.startTime = moment.utc( startTime ).valueOf();

			}

		}

		cloudwatchlogs.filterLogEvents( params, function( err, data ) {

			if ( err ) {
				reject( err );
				return;
			}
			if ( data.events ) {
	        	data.events.forEach( ( e ) => {

	            	process.stdout.write( formatLogEvent( e.message ) );

	          	});
	        }

	        // If we tail the logs then we need to set the
	        // start time from the last possible event
	        if ( process.env.COLLY__TAIL && ( data.events.length > 0) ) {

	        	startTime = data.events.pop().timestamp + 1;

	        }

	        // If we are tailing the logs, or there is another
	        // page of logs then recurse back into the function
	        const tail = JSON.parse( process.env.COLLY__TAIL );	        
	        if ( tail || data.nextToken ) {
	        	setTimeout( () => {
	        		showLogs( logStreamNames, ( data.nextToken || null ) );
	        	}, 1000);
	        }

	        resolve();

		});

	});

}

function init () {
	utils.authenticate()
	    .then( getLogs )
	    .then( showLogs )
	    .catch( console.log );
}

module.exports = {
	"init": init
}