const AWS   = require( "aws-sdk" );
const utils = require( "../utils" );

utils.setAwsRegion();

module.exports = function isLambdaAlreadyDeployed( options ) {

	const lambda = new AWS.Lambda();

	const lambdaConfig = utils.getLambdaConfigFile();

	lambda.listFunctions({}, function( err, data ) {
	  if ( err ) {
	  	throw new Error( err );
	  } else {
	  	let match = false;
	  	data.Functions.forEach( ( func ) => {
	  		if ( func.FunctionName === utils.getLambdaName() ) {
	  			match = true;
	  		}
	  	});
	  	if ( match ) {
	  		options.yes();
	  	} else {
	  		options.no();
	  	}
	  }
	});

}