const fs = require( "fs" );

function init ( lambdaName ) {

	lambdaName = lambdaName || process.env.COLLY__LAMBDA_NAME;

	const defaultLambdaTemplate = `
exports.handler = function ( event, context, callback ) {
	// Start here
}
	`;

	const defaultFunctionTemplate = `
{
	"memorySize": 128,
	"name": "${lambdaName}",
	"description": "",
	"handler": "${lambdaName}/index.handler",
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
			const path = `${process.env.COLLY__PROJECT_DIR}/${lambdaName}`;
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
			const path = `${process.env.COLLY__PROJECT_DIR}/${lambdaName}/${fileName}`;
			if ( !fs.existsSync( path ) ) {
				fs.writeFileSync( path, template );
				resolve();
			}
		});
	}

	return new Promise( ( resolve, reject ) => {

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
