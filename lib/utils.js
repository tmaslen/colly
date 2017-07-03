const glob    = require( "glob-fs" )({ gitignore: true });
const fs      = require( "fs" );
const request = require( "request" );
const path    = require( "path" );
const AWS     = require( "aws-sdk" );
const _       = require( "lodash" );
const cmd     = require( "node-cmd" );

function addLambdaEnvironmentVariablesToProcess ( environmentVariables ) {
    if ( environmentVariables ) {
        Object.keys( environmentVariables ).forEach( ( key ) => {
            process.env[ key ] = environmentVariables[ key ];
        });
    }
}

function authenticate () {

    return new Promise( ( resolve, reject ) => {

        if ( process.env.COLLY__USE_BASTION ) {

            console.log( "Authenticating via bastion servers..." );

            authenticateAgainstBastionService()
                .then( resolve );
            return;

        }

        if ( process.env.AWS_PROFILE ) {

            console.log( "Authenticating via local AWS profile..." );
            resolve();
            return;

        }

        reject( "No login credentials supplied" );

    });

}

function authenticateAgainstBastionService() {

    return new Promise( ( resolve, reject ) => {

        const projectConfig = getProjectConfig();
        const certPath = path.resolve( projectConfig.bastionService.certPath );
        const requestOptions = {
            url: projectConfig.bastionService.endpoint,
            agentOptions: {
                cert: fs.readFileSync( certPath ),
                key:  fs.readFileSync( certPath ),
                ca:   fs.readFileSync( projectConfig.bastionService.cloudServicesRoot )
            }
        };

        request.get( requestOptions, function ( error, response, body ) {

            if ( error || ( response && response.statusCode !== 200 ) ) {
            
                const statusCode = ( response && response.statusCode ) ? response.statusCode : 'no code';
                const errorMessage = `Unable to authenticate to AWS using the wormhole (Code: ${statusCode})`;

                reject( errorMessage );
            
            } else {
            
                const credentials = JSON.parse(body);

                process.env.AWS_ACCESS_KEY_ID     = credentials.accessKeyId;
                process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
                process.env.AWS_SESSION_TOKEN     = credentials.sessionToken;

                resolve();

            }

        });

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
    if ( env.toLowerCase() in envFiles ) {
        return envFiles[ env.toLowerCase() ];
    } else {
        console.log( "no env value defined" );
        throw new Error("`--env` parameter value has no matching colly file");
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

function getLambdaFilePath( offset ) {

    let offsetPath = "/";

    if ( offset ) {
        offsetPath = `/${offset}/`;
    }

    const config = getLambdaConfigFile( process.env.LAMBDA_NAME );

    const relativePathToLambdaFile = config.handler.split( "." ).slice( 0, -1 ).join( "." ) + ".js";

    return process.env.COLLY__PROJECT_DIR + offsetPath + relativePathToLambdaFile;

}

function copyAllFilesToDistDir () {
    return new Promise( ( resolve, reject ) => {
        const webpack = require( "webpack" );
        const config = getLambdaConfigFile( process.env.LAMBDA_NAME );
        const webpackOutput = getLambdaFilePath( "dist" );
        webpack({
            "entry": getLambdaFilePath(),
            "output": {
                "filename": webpackOutput
            }
        }, ( err, stats ) => {
            if ( err || stats.hasErrors() ) {
                reject( err );
            }
            console.log( stats.toString( {
              colors: true
            } ) );
            resolve( webpackOutput );
        });
    });
}

function setOptions ( cliOptions ) {

    if ( cliOptions.env ) {
        process.env.ENV = cliOptions.env;        
    }

    if ( cliOptions.name ) {
        process.env.COLLY__LAMBDA_NAME = cliOptions.name;        
    }

    if ( cliOptions.event ) {
        process.env.COLLY__LAMBDA_EVENT_FILE = cliOptions.event;        
    }

    if ( cliOptions.local ) {
        process.env.COLLY__RUN_LAMBDA_LOCAL = cliOptions.local;        
    }

    if ( cliOptions.use_bastion ) {
        process.env.COLLY__USE_BASTION = cliOptions.use_bastion;
    }

    if ( cliOptions.aws_profile ) {
        process.env.AWS_PROFILE = cliOptions.aws_profile;
    }

}

function setAwsRegion () {
    const projectConfig = getProjectConfig();
    AWS.config.region = projectConfig.region;
}

function lastItemInArray ( item, arr ) {
    return _.last( arr ) === item;
}

function addValueToLambdaConfig ( DotDelimitedProperty, value ) {

    let config = getLambdaConfigFile( process.env.LAMBDA_NAME );

    const propertyChain = DotDelimitedProperty.split( "." );

    let referencedPropertyToEdit = config;

    propertyChain.forEach( ( property, i, a ) => {
        
        if ( !( property in referencedPropertyToEdit ) ) {
            referencedPropertyToEdit[ property ] = {};
        }
        
        if ( lastItemInArray( property, propertyChain ) ) {
            referencedPropertyToEdit[ property ] = value;
        } else {
            referencedPropertyToEdit = referencedPropertyToEdit[ property ];
        }

    });

    fs.writeFileSync( getLambdaConfigFilePath( process.env.LAMBDA_NAME ), JSON.stringify( config, null, " " ) );

}

function zipFile ( webpackOutput ) {

    return new Promise( ( resolve, reject ) => {

        console.log( "Pruning the node_modules..." );

        cmd.get( `zip -9 -r ${webpackOutput}.zip ${webpackOutput}`, ( err, stdout ) => {

            console.log( stdout );

            resolve( `${webpackOutput}.zip` );

        });

    });

}

module.exports = {
	"addLambdaEnvironmentVariablesToProcess": addLambdaEnvironmentVariablesToProcess,
    "addValueToLambdaConfig": addValueToLambdaConfig,
	"anyEnvButLive": anyEnvButLive,
	"authenticate": authenticate,
    "chooseProjectFile": chooseProjectFile,
    "copyAllFilesToDistDir": copyAllFilesToDistDir,
	"everythingAfterTheLastDot": everythingAfterTheLastDot,
    "getLambdaConfigFile": getLambdaConfigFile,
    "getLambdaConfigFilePath": getLambdaConfigFilePath,
    "getLambdaFilePath": getLambdaFilePath,
    "getLambdaHandlerName": getLambdaHandlerName,
    "getLambdaName": getLambdaName,
    "getProjectConfig": getProjectConfig,
    "listEnvFiles": listEnvFiles,
    "setAwsRegion": setAwsRegion,
    "setOptions": setOptions,
    "zipFile": zipFile
}