const fs = require( "fs" );

const utils = require( "./utils" );

function getLambdaEventFile () {

	const path = `${process.env.COLLY__PROJECT_DIR}/${process.env.COLLY__LAMBDA_EVENT_FILE}`;

	if ( fs.existsSync( path ) ) {
    	return JSON.parse( fs.readFileSync( path, "utf8" ) );
    } else {
    	return {};
    }

}

function runningLocally () {
	return JSON.parse( process.env.COLLY__RUN_LAMBDA_LOCAL );
}

function runLocally () {


	return new Promise( ( resolve, reject ) => {

		const projectConfig = utils.getProjectConfig();

        utils.addLambdaEnvironmentVariablesToProcess( projectConfig.environmentVariables );

		const config = utils.getLambdaConfigFile();

		const lambdaHandler = getLambdaHandler();

		const eventFile = getLambdaEventFile();

		lambdaHandler(
			eventFile,
			{
				"done": () => {}
			},
			function callback( err, data ) {
				if ( err ) {
					reject( err );
				}
				resolve( data );
			}
		);

	});

}

function runDeployedLamda () {
	
	utils.authenticate()
		.then( () => {
			const config = utils.getLambdaConfigFile();
			const lambda = new AWS.Lambda();
			const params = {
				"FunctionName": utils.getLambdaName(),
				"InvocationType": "RequestResponse",
				"Payload": JSON.stringify( getLambdaEventFile() ),
				"LogType": "Tail"
			};

			lambda.invoke(params, function(err, data) {
				if ( err ) {
					console.log( err );
				} else {
					if ( data.LogResult ) {
						console.log( "Status code: " + data.StatusCode );
						console.log( "Payload: " + data.Payload );
						console.log( Buffer.from( data.LogResult, "base64" ).toString() );
					}
					// console.log( data );
				}
			});
		});

}

function getLambdaHandler() {
	try {
		return require( utils.getLambdaFilePath() )[ utils.getLambdaHandlerName() ];
	}
	catch( err ) {
		console.log( "Error: Cannot find the lambda you are trying to run. Check the `--name` or the handler property in the lambda's function file.");
		throw err;
	}
}

function init () {

	return new Promise( ( resolve, reject ) => {

		utils.authenticate().then( () => {

			if ( runningLocally() ) {
				runLocally()
					.then( ( data ) => {
						console.log( data );
						resolve( data );
					})
					.catch( reject );
			} else {
				runDeployedLamda();
			}
			resolve();

		});

	});

}

module.exports = {
	"getLambdaEventFile": getLambdaEventFile,
	"init": init,
	"runLocally": runLocally,
	"runningLocally": runningLocally
}