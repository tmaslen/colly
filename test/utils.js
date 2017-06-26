const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const fs     = require('fs-extra')

const utils = require( "../lib/utils" );

describe( "colly utils", () => {

	it( "should list all of the available config files", () => {

		process.env.COLLY_PROJECT_DIR = `./test/fakeProjectDirectory`;
		const expectedList = {
			"live": "colly.json",
			"test": "colly.test.json"
		}

		expect( utils.listEnvFiles() ).to.deep.equal( expectedList );

	});

	it( "should choose the correct config file to use", () => {

		expect( utils.chooseProjectFile( { "test": "colly.test.json" }, "test" ) ).to.equal( "colly.test.json" );

	});

	it( "should set the AWS profile for authentication", () => {

		utils.authenticate( { "aws_profile": "fakeProfile" } );
		expect( process.env.AWS_PROFILE ).to.equal( "fakeProfile" );

	} );

	it( "should return all the characters after the last dot in a string", () => {

		expect( utils.everythingAfterTheLastDot( "everything.before.thelastdot" ) ).to.equal( "thelastdot" );

	} );

	it( "should return the correct env name", () => {

		process.env.ENV = "live";
		expect( utils.anyEnvButLive() ).to.equal( "" );

		process.env.ENV = "test";
		expect( utils.anyEnvButLive() ).to.equal( "TEST" );

	} );

	it( "should return the lambda name in relation to the environment (e.g. live, test )", () => {

		process.env.ENV = "live";
		expect( utils.getLambdaName( "fakeLambdaName" ) ).to.equal( "fakeLambdaName" );

		process.env.ENV = "test";
		expect( utils.getLambdaName( "fakeLambdaName" ) ).to.equal( "fakeLambdaNameTEST" );

	});

	it( "should add values to the environment", () => {

		utils.addLambdaEnvironmentVariablesToProcess({
			"FOO": "bar",
			"LAR": "car"
		});
		expect( process.env.FOO ).to.equal( "bar" );
		expect( process.env.LAR ).to.equal( "car" );

	});

});