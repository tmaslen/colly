const fs = require( "fs" );

const defaultLambdaTemplate = `
exports.handler = function ( event, context, callback ) {
	// Start here
}
`;

const defaultFunctionTemplate = `
{
	"memorySize": 128,
	"name": "",
	"description": "",
	"handler": "queueWorker/index.handler",
	"runtime": "nodejs6.10",
	"timeout": 3,
	"userDefinedCodeToDeploy": [],	
    "deployedAssets": {
 	    "live": {}
    }
}
`;

function createLambdaDirectory ( lambdaName ) {
	return new Promise( ( resolve, reject ) => {
		const path = `${process.cwd()}/${lambdaName}`;
		if ( !fs.existsSync( path ) ){
		    fs.mkdirSync( path );
			resolve();
		} else {
			reject( `Lambda "${lambdaName}" already exists` );
		}
	});
}

function createFile ( fileName, template, lambdaName) {
	return new Promise( ( resolve ) => {
		const path = `${process.cwd()}/${lambdaName}/${fileName}`;
		if ( !fs.existsSync( path ) ) {
			fs.writeFileSync( path, template );
			resolve();
		}
	});
}

function init ( lambdaName ) {

	return new Promise( ( resolve, reject ) => {

		lambdaName = lambdaName || process.env.COLLY__LAMBDA_NAME;

		createLambdaDirectory( lambdaName )
			.then( createFile( "index.js", defaultLambdaTemplate, lambdaName ) )
			.then( createFile( "function.json", defaultFunctionTemplate, lambdaName ) )
			.then( () => {
				resolve( `Lambda "${lambdaName}" created!` );
			})
			.catch( reject );

	});

}

module.exports = init;
