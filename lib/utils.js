const globby  = require( "globby" );
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
    if ( env.trim() === "" ) {
        env = "live";
    }
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
    let opts = {
        "dot": true
    };
    if ( path.substring(0,1) === "/" ) {
        opts.cwd = "/";
    }
    const relativePaths = globby.sync( path );
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

function getLambdaFilePath( altStartOfPath ) {

    const startOfPath = altStartOfPath || process.env.COLLY__PROJECT_DIR;

    const config = getLambdaConfigFile( process.env.COLLY__LAMBDA_NAME );

    const relativePathToLambdaFile = config.handler.split( "." ).slice( 0, -1 ).join( "." ) + ".js";

    return startOfPath + "/" + relativePathToLambdaFile;

}

function copyAllFilesToDistDir () {
    return new Promise( ( resolve, reject ) => {
        const webpack = require( "webpack" );
        const config = getLambdaConfigFile( process.env.COLLY__LAMBDA_NAME );
        const webpackOutput = getLambdaFilePath( "./dist" );
        webpack({
            "context": process.env.COLLY__PROJECT_DIR,
            "entry": getLambdaFilePath(),
            "output": {
                "filename": webpackOutput,
                "libraryTarget": "commonjs"
            },
            "target": "node",
            "externals": [ "aws-sdk" ]
        }, ( err, stats ) => {
            if ( err || stats.hasErrors() ) {
                reject( err );
            }
            console.log( stats.toString( {
              colors: true
            } ) );
            resolve( `./dist/${process.env.COLLY__LAMBDA_NAME}` );
        });
    });
}

function optionsCustomiser ( objVal, srcVal, propName ) {
    const validOptionNames = [
        "env",
        "name",
        "event",
        "local",
        "use_bastion",
        "aws_profile"
    ];
    console.log( propName );
    if ( validOptionNames.indexOf( propName ) > -1 ) {
        if ( srcVal ) {
            return srcVal;
        } else {
            return objVal;
        }
    } else {

    }
}

function formatConfigFile( configFile ) {
    const propertyNameMap = {
        "useBastion": "use_bastion",
        "awsProfile": "aws_profile"
    }
    let formattedConfigFile = {};
    Object.keys( configFile ).forEach( propName => {
        if ( propName in propertyNameMap ) {
            formattedConfigFile[ propertyNameMap[ propName ] ] = configFile[ propName ];
        }
    });
    return formattedConfigFile;
}

function filterOptions( options, ) {
    const validOptionNames = [
        "env",
        "name",
        "event",
        "local",
        "use_bastion",
        "aws_profile",
        "search",
        "start_time",
        "tail"
    ];
    return _.pickBy( options, ( val, name ) => {
        return ( validOptionNames.indexOf( name ) > -1 );
    })
}

function setOptions ( cliOptions ) {

    if ( cliOptions.env ) {
        process.env.ENV = cliOptions.env;
    } else {
        process.env.ENV = "live";
    }

    projectConfig = getProjectConfig();

    const options = filterOptions( _.defaults( formatConfigFile( projectConfig ), cliOptions ) );

    if ( options.name ) {
        process.env.COLLY__LAMBDA_NAME = options.name;        
    }

    if ( options.event ) {
        process.env.COLLY__LAMBDA_EVENT_FILE = options.event;        
    }

    if ( typeof options.local === "boolean" ) {
        process.env.COLLY__RUN_LAMBDA_LOCAL = options.local;        
    }

    if ( options.use_bastion ) {
        process.env.COLLY__USE_BASTION = options.use_bastion;
    }

    if ( options.aws_profile ) {
        process.env.AWS_PROFILE = options.aws_profile;
    }

    if ( !process.env.COLLY__PROJECT_DIR ) {
        process.env.COLLY__PROJECT_DIR = process.cwd();
    }

    if ( options.search ) {
        process.env.COLLY__SEARCH = options.search;
    }

    if ( options.start_time ) {
        process.env.COLLY__START_TIME = options.start_time;
    }

    if ( typeof options.tail === "boolean" ) {
        process.env.COLLY__TAIL = options.tail;
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

function zipFile ( package ) {

    return new Promise( ( resolve, reject ) => {

        console.log( "Zipping the webpack output... " );

        cmd.get( `cd dist && zip -9 -r ${process.env.COLLY__LAMBDA_NAME}.zip ${process.env.COLLY__LAMBDA_NAME}`, ( err, stdout ) => {

            console.log( stdout );

            resolve( `${package}.zip` );

        });

    });

}

function addEnvVarToProjectConfig ( name, value ) {

    let projectConfig = getProjectConfig();
    if ( !( "environmentVariables" in projectConfig ) ) {
        projectConfig.environmentVariables = {};
    }
    projectConfig.environmentVariables[ name ] = value;
    fs.writeFileSync( getProjectConfigFilePath(), JSON.stringify( projectConfig, null, " " ) );

}

module.exports = {
    "addEnvVarToProjectConfig": addEnvVarToProjectConfig,
	"addLambdaEnvironmentVariablesToProcess": addLambdaEnvironmentVariablesToProcess,
    "addValueToLambdaConfig": addValueToLambdaConfig,
	"anyEnvButLive": anyEnvButLive,
	"authenticate": authenticate,
    "chooseProjectFile": chooseProjectFile,
    "copyAllFilesToDistDir": copyAllFilesToDistDir,
	"everythingAfterTheLastDot": everythingAfterTheLastDot,
    "formatConfigFile": formatConfigFile,
    "getLambdaConfigFile": getLambdaConfigFile,
    "getLambdaConfigFilePath": getLambdaConfigFilePath,
    "getLambdaFilePath": getLambdaFilePath,
    "getLambdaHandlerName": getLambdaHandlerName,
    "getLambdaName": getLambdaName,
    "getProjectConfig": getProjectConfig,
    "getProjectConfigFilePath": getProjectConfigFilePath,
    "listEnvFiles": listEnvFiles,
    "setAwsRegion": setAwsRegion,
    "setOptions": setOptions,
    "zipFile": zipFile
}