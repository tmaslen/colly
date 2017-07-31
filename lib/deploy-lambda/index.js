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

function createApiGateway () {

    return new Promise( ( resolve, reject ) => {

        const config = utils.getLambdaConfigFile();

        if (
            config.apiGateway &&
            !( "apiGatewayArn" in config.deployedAssets[ process.env.ENV ] )
        ) {
            const createApiGateway = require( "./createApiGateway" );
            console.log( createApiGateway.init() );
            // createApiGateway.init()
            //     .then( resolve )
            //     .catch( reject );
        } else {
            resolve();
        }

    });

}

module.exports = function () {
	utils.authenticate()
		.then( createApiGateway )
//	 	.then( decideHowToDeployLambda )
		.catch( console.log );
}