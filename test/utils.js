const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const AWS    = require( "aws-sdk" );
const sinon  = require( "sinon" );
const fs     = require( "fs" );

const utils = require( "../lib/utils" );

function stubObjectWithReturnValue( object, method, returnValue ) {
	const stub = sinon.stub( object, method );
	stub.returns( returnValue );
	return stub;
}

describe( "colly utils", () => {

	afterEach( () => {

		process.env.LAMBDA__ENV              = "";
		process.env.COLLY__LAMBDA_NAME       = "";
		process.env.COLLY__LAMBDA_EVENT_FILE = "";
		process.env.COLLY__RUN_LAMBDA_LOCAL  = "";
		process.env.COLLY__PROJECT_DIR       = "";
		process.env.AWS_PROFILE              = "";
		process.env.COLLY__USE_BASTION       = "";

	});

	it( "should list all of the available config files", () => {

		process.env.COLLY__PROJECT_DIR = `./test/fakeProjectDirectory`;
		const expectedList = {
			"live": "colly.json",
			"test": "colly.test.json"
		}

		expect( utils.listEnvFiles() ).to.deep.equal( expectedList );

	});

	it( "should default the config file to live when no env is set", () => {

		expect( utils.chooseProjectFile( { "live": "colly.json" }, "" ) ).to.equal( "colly.json" );
		
	});

	it( "should choose the correct config file to use", () => {

		expect( utils.chooseProjectFile( { "test": "colly.test.json" }, "test" ) ).to.equal( "colly.test.json" );

	});

	it( "should fetch the correct project config file", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fakeProjectDirectory";
		process.env.LAMBDA__ENV = "live";

		const expected = {
			"environmentVariables": {
				"env": "live"
			}
		};

		expect( utils.getProjectConfig() ).to.deep.equal( expected );

	} );

	it( "should correctly set options based on the command line params and the config file", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		stub = stubObjectWithReturnValue( fs, "readFileSync", "{}" );
		const cliOptions = {
			"env":         "live",
			"name":        "myLambda",
			"event":       "ref/to/event/file.json",
			"local":       true,
			"use_bastion": true,
			"aws_profile": "myAwsProfileName"
		};

		utils.setOptions( cliOptions );

		expect( process.env.LAMBDA__ENV ).to.equal( cliOptions.env );
		expect( process.env.COLLY__LAMBDA_NAME ).to.equal( cliOptions.name );
		expect( process.env.COLLY__LAMBDA_EVENT_FILE ).to.equal( cliOptions.event );
		expect( process.env.COLLY__RUN_LAMBDA_LOCAL ).to.equal( cliOptions.local.toString() );
		expect( process.env.COLLY__USE_BASTION ).to.equal( cliOptions.use_bastion.toString() );
		expect( process.env.AWS_PROFILE ).to.equal( cliOptions.aws_profile );

		stub.restore();

	});

	it( "should return all the characters after the last dot in a string", () => {

		expect( utils.everythingAfterTheLastDot( "everything.before.thelastdot" ) ).to.equal( "thelastdot" );

	} );

	it( "should return the correct env name", () => {

		process.env.LAMBDA__ENV = "live";
		expect( utils.anyEnvButLive() ).to.equal( "" );

		process.env.LAMBDA__ENV = "test";
		expect( utils.anyEnvButLive() ).to.equal( "TEST" );

	} );

	it( "should return the lambda name in relation to the environment (e.g. live, test )", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";

		process.env.LAMBDA__ENV = "live";
		expect( utils.getLambdaName( "fakeLambdaName" ) ).to.equal( "fakeLambdaName" );

		process.env.LAMBDA__ENV = "test";
		expect( utils.getLambdaName( "fakeLambdaName" ) ).to.equal( "fakeLambdaNameTEST" );

	});

	it( "should format the name according to the property in the colly.json file", () => {

		process.env.LAMBDA__ENV = "test";
		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		expect( utils.getLambdaName( "fakeName", "nameSpace__${env}--${name}" ) ).to.equal( "nameSpace__TEST--fakeName" );

	});

	it( "should add values to the environment", () => {

		utils.addLambdaEnvironmentVariablesToProcess({
			"FOO": "bar",
			"LAR": "car"
		});
		expect( process.env.FOO ).to.equal( "bar" );
		expect( process.env.LAR ).to.equal( "car" );

	});

	it( "should return the path to the lambda config file", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";

		expect( utils.getLambdaConfigFilePath() ).to.equal( "./test/fixtures/utils/fetchConfigFile/function.json" );

	});

	it( "should return fetch the lambda config", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";

		const expectedConfigFile = {
			"name": "fetchConfigFile",
			"handler": "fetchConfigFile/index.handler"
		}

		expect( utils.getLambdaConfigFile() ).to.deep.equal( expectedConfigFile );

	});

	it( "should return the lambda handler name", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";

		expect( utils.getLambdaHandlerName() ).to.equal( "handler" );

	} );

	it( "should return the path to the lambda file", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";
		expect( utils.getLambdaFilePath() ).to.equal( "./test/fixtures/utils/fetchConfigFile/index.js" );
	} );

	it( "should return the path to the lambda file with an alt start to path", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";
		expect( utils.getLambdaFilePath( "./offset/dir") ).to.equal( "./offset/dir/fetchConfigFile/index.js" );
	} );

	it( "should set the AWS region property", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.LAMBDA__ENV = "LIVE";
		utils.setAwsRegion();
		expect( AWS.config.region ).to.equal( "eu-west-1" );

	} );

	it( "should ADD a value to the project config", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "fetchConfigFile";
		process.env.LAMBDA__ENV = "LIVE";
		const stubbedWriteFileSync = sinon.stub( fs, "writeFileSync" );
		const expectedResult = {
			"name": "fetchConfigFile",
			"handler": "fetchConfigFile/index.handler",
			"test": {
				"foo": {
					"bar": "test value"
				}
			}
		};


		utils.addValueToLambdaConfig( "test.foo.bar", "test value" );
		expect( JSON.parse( stubbedWriteFileSync.getCall(0).args[1] ) ).to.deep.equal( expectedResult );

		fs.writeFileSync.restore();

	});

	it( "should REMOVE a value from the project config", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "removeValueFromLambdaConfig";
		process.env.LAMBDA__ENV = "LIVE";
		const stubbedWriteFileSync = sinon.stub( fs, "writeFileSync" );
		const expectedResult = {
			"foo": {
				"bar": {}
			}
		};


		utils.removeValueFromLambdaConfig( "foo.bar.name" );
		expect( JSON.parse( stubbedWriteFileSync.getCall(0).args[1] ) ).to.deep.equal( expectedResult );

		fs.writeFileSync.restore();

	});

	it( "should GET a value from the project config", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.COLLY__LAMBDA_NAME = "getConfigFileValue";

		expect( utils.getValueFromLambdaConfig( "deployedAssets.test.roleArn" ) ).to.equal( "arn:aws:iam::0123456789:role/roleName" );
		expect( utils.getValueFromLambdaConfig( "deployedAssets.live.roleArn" ) ).to.equal( undefined );

	});

	it( "should reformat the config file to make it compatible with the CLI options object", () => {

		const configObject = {
			"useBastion": true,
			"awsProfile": true,
			"notWantedProperty": true
		}
		const reformatedObject = {
			"use_bastion": true,
			"aws_profile": true
		}

		expect( utils.formatConfigFile( configObject ) ).to.deep.equal( reformatedObject );

	})

	it( "should use settings defined in the config file", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.LAMBDA__ENV = "LIVE";
		const fakeConfig = {
			"useBastion": true
		}

		const stubbedReadFileSync = stubObjectWithReturnValue( fs, "readFileSync", JSON.stringify( fakeConfig ) );

		utils.setOptions( {} );

		expect( process.env.COLLY__USE_BASTION ).to.equal( "true" );

		stubbedReadFileSync.restore();
	} );

	it( "pathToOtherModule function", () => {

		expect( utils.pathToOtherModule( "node_modules/async/index.js", "package.json" ) ).to.equal( "node_modules/async/package.json" );
		expect( utils.pathToOtherModule( "node_modules/async/lib/index.js", "package.json" ) ).to.equal( "node_modules/async/package.json" );
		expect( utils.pathToOtherModule( "node_modules/async/node_modules/abc/index.js", "package.json" ) ).to.equal( "node_modules/async/node_modules/abc/package.json" );
		expect( utils.pathToOtherModule( "node_modules/async/node_modules/abc/bin/index.js", "package.json" ) ).to.equal( "node_modules/async/node_modules/abc/package.json" );

	});

	it( "getListOfAdditionalDeploymentAssets", () => {

		process.env.COLLY__PROJECT_DIR = "./test/fixtures/utils";
		process.env.LAMBDA__ENV = "LIVE";
		process.env.COLLY__LAMBDA_NAME = "getListOfAdditionalDeploymentAssets";

		expect( utils.getListOfAdditionalDeploymentAssets() ).to.deep.equal([
			"foo.js",
			"bar.js"
		]);

	});

});