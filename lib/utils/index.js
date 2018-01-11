const globby  = require( "globby" );
const fs      = require( "fs" );
const request = require( "request" );
const path    = require( "path" );
const AWS     = require( "aws-sdk" );
const _       = require( "lodash" );
const cmd     = require( "node-cmd" );
const webpack = require( "webpack" );
const ncp     = require( "ncp" ).ncp;
const makeDir = require( "make-dir" );
const del     = require( "del" );

const lambdaDeployStagingDir = "dist";

function addLambdaEnvironmentVariablesToProcess ( environmentVariables ) {
    if ( environmentVariables ) {
        Object.keys( environmentVariables ).forEach( ( key ) => {
            process.env[ key ] = environmentVariables[ key ];
        });
    }
}

function assumeLambdaRole () {
    return new Promise( ( resolve, reject ) => {

        const roleArn = getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.${getLambdaName()}RoleArn` );
        
        if ( roleArn ) {

            var sts = new AWS.STS();
            const params = {
                "DurationSeconds": 900, 
                "RoleArn": roleArn,
                "RoleSessionName": "LambdaRunner"
            };
            sts.assumeRole(params, function(err, data) {
                if (err) {
                    throw new Error( err );
                    reject();
                } else {
                    process.env.AWS_ACCESS_KEY_ID     = data.Credentials.AccessKeyId;
                    process.env.AWS_SECRET_ACCESS_KEY = data.Credentials.SecretAccessKey;
                    process.env.AWS_SESSION_TOKEN     = data.Credentials.SessionToken;
                    resolve();
                }
            });

        } else {

            resolve();

        }
        
    });
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
    return dotDelimitedString.split( "." ).pop();
}

function getLambdaName ( nameOverride, templateOverride ) {

    const defaultTemplate = "${name}${env}";

    const name = nameOverride || getLambdaConfigFile().name;

    const env = anyEnvButLive();

    const template = templateOverride || getProjectConfig().nameTemplate || defaultTemplate;

    return template.replace( "${name}", name ).replace( "${env}", env );

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
        const fileNameParts = fileName.split( "." );
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

function prepLambdaDeployStagingDir () {
    return new Promise( ( resolve ) => {

        del.sync( [ `./${lambdaDeployStagingDir}` ] );
        resolve();

    });
}

function copyAllFilesToDistDir () {
    return new Promise( ( resolve, reject ) => {

        const config = getLambdaConfigFile( process.env.COLLY__LAMBDA_NAME );
        const webpackOutput = getLambdaFilePath( `./${lambdaDeployStagingDir}` );

        webpack({
            "context": process.env.COLLY__PROJECT_DIR,
            "entry": getLambdaFilePath(),
            "output": {
                "filename": getLambdaFilePath( `./${lambdaDeployStagingDir}` ),
                "libraryTarget": "commonjs"
            },
            "target": "node",
            "externals": [ "aws-sdk" ]
        }, ( err, stats ) => {

            if ( err || stats.hasErrors() ) {
                reject( err );
                return;
            }

            Promise.all( stats.compilation.fileDependencies.map( path => {

                return new Promise( ( resolve ) => {
                
                    const relativePath = makeRelative( path );
                    const relativePathToDir = dirPathFor( relativePath );
                    makeDir( `${lambdaDeployStagingDir}/${relativePathToDir}` )
                        .then( () => {
                            copyFile( relativePath ).then( resolve );
                        })
                        .catch( () => {
                            copyFile( relativePath ).then( resolve );
                        });
                
                });
            
            })).then( () => {

                resolve( `./${lambdaDeployStagingDir}/${process.env.COLLY__LAMBDA_NAME}` );

            }).catch( reject );

        });
    });
}

function makeRelative ( path ) {
    return path.split( `${process.cwd()}/` )[ 1 ];
}

function dirPathFor ( assetPath ) {
    const assetPathInPieces = assetPath.split( "/" );
    assetPathInPieces.pop();
    return assetPathInPieces.join( "/" );
}

function copyFile ( filePath ) {
    return new Promise( ( resolve, reject ) => {

        let filesToCopy = [{
            "from": `./${filePath}`,
            "to": `./${lambdaDeployStagingDir}/${filePath}`
        }];

        if ( isNodeModule( filePath ) ) {
            
            const packageJsonPath = pathToOtherModule( filePath, "package.json" );
            filesToCopy.push({
                "from": `./${packageJsonPath}`,
                "to": `./${lambdaDeployStagingDir}/${packageJsonPath}`
            });
        }

        // Resolves issue https://github.com/tmaslen/colly/issues/3
        if ( isNodeModuleUglifyJS( filePath ) ) {

            const uglifyJSLibPath = pathToOtherModule( filePath, "lib" );
            filesToCopy.push({
                "from": `./${uglifyJSLibPath}`,
                "to": `./${lambdaDeployStagingDir}/${uglifyJSLibPath}`
            });

            const exportsJsPath = pathToOtherModule( filePath, "tools/exports.js" );
            if ( fs.existsSync( `./${exportsJsPath}` ) ) {
                filesToCopy.push({
                    "from": `./${exportsJsPath}`,
                    "to": `./${lambdaDeployStagingDir}/${exportsJsPath}`
                });
            }

        }

        // Resolves issue https://github.com/tmaslen/colly/issues/4
        if ( isNodeModuleMime( filePath ) ) {

            const mimeTypesPath = pathToOtherModule( filePath, "types" );
            if ( fs.existsSync( `./${mimeTypesPath}` ) ) {
                filesToCopy.push({
                    "from": `./${mimeTypesPath}`,
                    "to": `./${lambdaDeployStagingDir}/${mimeTypesPath}`
                });
            }

        }

        // Another hack similiar to the one above
        if ( isNodeModuleMimer( filePath ) ) {

            const mimeTypesPath = pathToOtherModule( filePath, "lib/data/mime.types" );
            if ( fs.existsSync( `./${mimeTypesPath}` ) ) {
                filesToCopy.push({
                    "from": `./${mimeTypesPath}`,
                    "to": `./${lambdaDeployStagingDir}/${mimeTypesPath}`
                });
            }

        }

        Promise.all(filesToCopy.map( ( fileToCopy ) => {

            return new Promise( ( resolve, reject ) => {

                ncp( fileToCopy.from, fileToCopy.to, ( err ) => {
                    if ( err ) {
                        reject( err );
                        return;
                    }
                    resolve();
                } );

            });

        })).then(resolve).catch(reject)
        
    });

}

function isNodeModuleUglifyJS ( path ) {
    const pathDirectories = path.split( "/" );
    return pathDirectories[ 0 ] === "node_modules" && pathDirectories[ 1 ] === "uglify-js";
}

function isNodeModuleMime ( path ) {
    const pathDirectories = path.split( "/" );
    return pathDirectories[ 2 ] === "node_modules" && pathDirectories[ 3 ] === "mime";   
}

function isNodeModuleMimer ( path ) {
    const pathDirectories = path.split( "/" );
    return pathDirectories.includes( "node_modules" ) && pathDirectories.includes( "mimer.js" );   
}

function pathToOtherModule ( filePath, otherModule ) {
    let filePathSplit = filePath.split( "/" );
    filePathSplit.pop();
    const posOfNodeModulesDir = _.lastIndexOf( filePathSplit, "node_modules" ) + 2;
    let pathToOtherModule = filePathSplit.slice( 0, posOfNodeModulesDir );
    pathToOtherModule.push( otherModule );
    return pathToOtherModule.join( "/" );
}

function isNodeModule ( path ) {
    return path.split( "/" )[ 0 ] === "node_modules"
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

function filterOptions( options ) {
    const validOptionNames = [
        "env",
        "name",
        "event",
        "local",
        "use_bastion",
        "aws_profile",
        "context",
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

    if ( !process.env.COLLY__PROJECT_DIR ) {
        process.env.COLLY__PROJECT_DIR = process.cwd();
    }

    projectConfig = getProjectConfig();

    const options = filterOptions( _.defaults( formatConfigFile( projectConfig ), cliOptions ) );

    if ( options.name ) {
        process.env.COLLY__LAMBDA_NAME = options.name;        
    }

    if ( options.event ) {
        process.env.COLLY__LAMBDA_EVENT_FILE = options.event;        
    }

    if ( options.context ) {
        process.env.COLLY__LAMBDA_CONTEXT_FILE = options.context;        
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

function removeValueFromLambdaConfig( DotDelimitedProperty ) {

    let config = getLambdaConfigFile( process.env.LAMBDA_NAME );

    const propertyChain = DotDelimitedProperty.split( "." );

    let referencedPropertyToEdit = config;

    propertyChain.forEach( ( property, i, a ) => {

        if ( !( property in referencedPropertyToEdit ) ) {
            return;
        }
        
        if ( lastItemInArray( property, propertyChain ) ) {
            delete referencedPropertyToEdit[ property ];
        } else {
            referencedPropertyToEdit = referencedPropertyToEdit[ property ];
        }

    });

    fs.writeFileSync( getLambdaConfigFilePath( process.env.LAMBDA_NAME ), JSON.stringify( config, null, " " ) );

}

function getValueFromLambdaConfig ( DotDelimitedProperty ) {

    let returnValue = undefined;

    let config = getLambdaConfigFile( process.env.LAMBDA_NAME );

    const propertyChain = DotDelimitedProperty.split( "." );

    let referencedPropertyToEdit = config;

    propertyChain.forEach( ( property, i, a ) => {
        
        if ( property in referencedPropertyToEdit ) {
            if ( lastItemInArray( property, propertyChain ) ) {
                    returnValue = referencedPropertyToEdit[ property ];
            } else {
                referencedPropertyToEdit = referencedPropertyToEdit[ property ];
            }
        }

    });

    return returnValue;

}

function zipFile ( package ) {

    return new Promise( ( resolve, reject ) => {

        console.log( "Zipping the webpack output... " );

        cmd.get( `cd ${lambdaDeployStagingDir} && zip -9 -r ${process.env.COLLY__LAMBDA_NAME}.zip .`, ( err, stdout ) => {

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

function copyAdditionalFiles ( packagename ) {
    return new Promise( ( resolve, reject ) => {

        const additionalDeploymentAssets = getListOfAdditionalDeploymentAssets();

        if ( additionalDeploymentAssets.length > 0 ) {
            const promises = additionalDeploymentAssets.map( asset => {
                return new Promise ( ( resolve, reject ) => {
                    ncp( `./${asset}`, `./${lambdaDeployStagingDir}/${asset}`, resolve );
                });
            });
            Promise.all( promises ).then( () => {
                resolve( packagename );
            });
        } else {
            resolve( packagename );
        }

    });
}

function getListOfAdditionalDeploymentAssets () {
    return []
        .concat( getProjectConfig().additionalDeploymentAssets || [] )
        .concat( getValueFromLambdaConfig( "additionalDeploymentAssets" ) || [] );
}

function getLambdaRoleArnKey() {
    // This is to maintain backward compatibility.
    // Lambda role ARNs used to be stored with the key "roleArn".
    return getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.${getLambdaName()}RoleArn` ) || getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.roleArn` );
}

module.exports = {
    "addEnvVarToProjectConfig": addEnvVarToProjectConfig,
    "addLambdaEnvironmentVariablesToProcess": addLambdaEnvironmentVariablesToProcess,
    "addValueToLambdaConfig": addValueToLambdaConfig,
    "anyEnvButLive": anyEnvButLive,
    "assumeLambdaRole": assumeLambdaRole,
    "authenticate": authenticate,
    "chooseProjectFile": chooseProjectFile,
    "constants": {
        "lambdaDeployStagingDir": lambdaDeployStagingDir
    },
    "copyAllFilesToDistDir": copyAllFilesToDistDir,
    "copyAdditionalFiles": copyAdditionalFiles,
    "everythingAfterTheLastDot": everythingAfterTheLastDot,
    "formatConfigFile": formatConfigFile,
    "getLambdaConfigFile": getLambdaConfigFile,
    "getLambdaConfigFilePath": getLambdaConfigFilePath,
    "getLambdaFilePath": getLambdaFilePath,
    "getLambdaHandlerName": getLambdaHandlerName,
    "getLambdaName": getLambdaName,
    "getLambdaRoleArnKey": getLambdaRoleArnKey,
    "getListOfAdditionalDeploymentAssets": getListOfAdditionalDeploymentAssets,
    "getProjectConfig": getProjectConfig,
    "getProjectConfigFilePath": getProjectConfigFilePath,
    "getValueFromLambdaConfig": getValueFromLambdaConfig,
    "listEnvFiles": listEnvFiles,
    "pathToOtherModule": pathToOtherModule,
    "prepLambdaDeployStagingDir": prepLambdaDeployStagingDir,
    "removeValueFromLambdaConfig": removeValueFromLambdaConfig,
    "setAwsRegion": setAwsRegion,
    "setOptions": setOptions,
    "zipFile": zipFile
}