const glob = require('glob-fs')({ gitignore: true });
const fs   = require( "fs" );


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

function chooseProjectFile( envFiles, env ) {
    if ( env in envFiles ) {
        return envFiles[ env ];
    } else {
        console.log( "no env value defined" );
        throw new Error("`--env` parameter value has no matching collie file");
    }
}

function getLambdaConfigFilePath () {
    return `${process.env.COLLY__PROJECT_DIR}/${process.env.COLLY__LAMBDA_NAME}/function.json`;
}

function getLambdaConfigFile () {
    return JSON.parse( fs.readFileSync( getLambdaConfigFilePath() ) );
}

function getLambdaHandlerName () {
    const config = getLambdaConfigFile();
    return everythingAfterTheLastDot( config.handler );
}

function listEnvFiles () {
    
    const path = `${process.env.COLLY__PROJECT_DIR}/colly*.json`;
    let opts = {};
    if ( path.substring(0,1) === "/" ) {
        opts.cwd = "/";
    }
    const relativePaths = glob.readdirSync( path, opts );
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

function getProjectConfigFilePath () {
    return `${process.env.COLLY__PROJECT_DIR}/${ chooseProjectFile( listEnvFiles(), process.env.ENV ) }`;
}

function getProjectConfig() {
    return JSON.parse( fs.readFileSync( getProjectConfigFilePath() ) );
}

function getLambdaFilePath() {

    const config = getLambdaConfigFile( process.env.LAMBDA_NAME );

    const relativePathToLambdaFile = config.handler.split( "." ).slice( 0, -1 ).join( "." ) + ".js";

    return `${process.env.COLLY__PROJECT_DIR}/${relativePathToLambdaFile}`;

}

module.exports = {
	"addLambdaEnvironmentVariablesToProcess": addLambdaEnvironmentVariablesToProcess,
	"anyEnvButLive": anyEnvButLive,
	"authenticate": authenticate,
    "chooseProjectFile": chooseProjectFile,
	"everythingAfterTheLastDot": everythingAfterTheLastDot,
    "getLambdaConfigFile": getLambdaConfigFile,
    "getLambdaConfigFilePath": getLambdaConfigFilePath,
    "getLambdaFilePath": getLambdaFilePath,
    "getLambdaHandlerName": getLambdaHandlerName,
    "getLambdaName": getLambdaName,
    "getProjectConfig": getProjectConfig,
    "listEnvFiles": listEnvFiles
}