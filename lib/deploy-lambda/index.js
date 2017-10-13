const isLambdaAlreadyDeployed = require( "./isLambdaAlreadyDeployed" );
const updateLambda = require( "./updateLambda" ).init;
const createLambda = require( "./createLambda" );

const utils = require( "../utils" );

function decideHowToDeployLambda () {

	isLambdaAlreadyDeployed({
		"yes": updateLambda,
		"no":  createLambda
	});

}

module.exports = function () {
	utils.authenticate()
	 	.then( decideHowToDeployLambda )
		.catch( console.log );
}