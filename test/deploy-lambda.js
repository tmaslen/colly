const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;

process.env.ENV = "live";
const updateLambda = require( "../lib/deploy-lambda/updateLambda" );

describe( "colly deploy-lambda", () => {

	describe( "Configuring the Lambda", () => {

		describe( "configShouldBeUpdated, Environment variables", () => {


			it( "Should return FALSE when there are no environment variables", () => {

				const projectConfig = {};
				const deployedConfig = {};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( false );

			});

			it( "Should return TRUE when there are new environment variables", () => {

				const projectConfig = {
					"environmentVariables": {
						"foo": "bar"
					}
				};
				const deployedConfig = {};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

			it( "Should return TRUE when there are changes to environment variables", () => {

				const projectConfig = {
					"environmentVariables": {
						"foo": "bar",
						"lar": "car"
					}
				};
				const deployedConfig = {
					"Environment": {
						"Variables": {
							"foo": "bar"
						}
					}
				};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

			it( "Should return TRUE when removing environment variables", () => {

				const projectConfig = {};
				const deployedConfig = {
					"Environment": {
						"Variables": {
							"foo": "bar"
						}
					}
				};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

		});

	});

});