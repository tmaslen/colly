const glob = require('glob-fs')({ gitignore: true });

function addLambdaEnvironmentVariablesToProcess ( environmentVariables ) {
    if ( environmentVariables ) {
        Object.keys( environmentVariables ).forEach( ( key ) => {
            process.env[ key ] = environmentVariables[ key ];
        });
    }
}

function authenticate ( passedOptions ) {

    authOptions = passedOptions || options;

    return new Promise( ( resolve, reject ) => {

        if ( authOptions.use_bastion ) {

            console.log( "Authenticating via bastion servers..." );

            authenticateAgainstBastionService()
                .then( resolve );
            return;

        }

        if ( authOptions.aws_profile ) {

            console.log( "Authenticating via local AWS profile..." );

            process.env.AWS_PROFILE = authOptions.aws_profile;
            resolve();
            return;

        }

        reject( "No login credentials supplied" );

    });

}

function everythingAfterTheLastDot( dotDelimitedString ) {
    return dotDelimitedString.split(".").pop();
}

function getLambdaName ( nameOverride ) {

    const appendedToName = anyEnvButLive();

    return ( nameOverride || getLambdaConfigFile().name ) + appendedToName;

}

function anyEnvButLive () {
    return ( process.env.ENV !== "live" ) ? process.env.ENV.toUpperCase() : "";
}

function listEnvFiles () {
    const relativePaths = glob.readdirSync( `${process.env.COLLY_PROJECT_DIR}/colly*.json` );
    let envFiles = {};
    relativePaths.forEach( ( relativePath ) => {
        
        const fileName = relativePath.split( "/" ).pop();
        const fileNameParts = fileName.split(".");
        let envName;
        if ( fileName === "colly.json" ) {
            envName = "live";
        }
        
        if ( fileNameParts.length > 2 ) {
            envName = fileNameParts[ 1 ];
        }

        envFiles[ envName ] = fileName;

    });
    return envFiles;
}

function chooseProjectFile( envFiles, env ) {
    if ( env in envFiles ) {
        return envFiles[ env ];
    } else {
        throw new Error("`--env` parameter value has no matching collie file");
    }
}

module.exports = {
	"addLambdaEnvironmentVariablesToProcess": addLambdaEnvironmentVariablesToProcess,
	"anyEnvButLive": anyEnvButLive,
	"authenticate": authenticate,
    "chooseProjectFile": chooseProjectFile,
	"everythingAfterTheLastDot": everythingAfterTheLastDot,
	"getLambdaName": getLambdaName,
    "listEnvFiles": listEnvFiles
}