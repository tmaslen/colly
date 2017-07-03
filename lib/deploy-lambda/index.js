const isLambdaAlreadyDeployed = require( "./isLambdaAlreadyDeployed" );
const updateLambda = require( "./updateLambda" );
const createLambda = require( "./createLambda" );

const utils = require( "../utils" );

function decideHowToDeployLambda () {

	isLambdaAlreadyDeployed({
		"yes": updateLambda,
		"no":  createLambda
	});

}

utils.authenticate()
 	.then( decideHowToDeployLambda )
	.catch( console.log );