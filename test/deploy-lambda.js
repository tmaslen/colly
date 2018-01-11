const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const AWS    = require( "aws-sdk" );
const sinon  = require( "sinon" );

process.env.LAMBDA__ENV = "live";
const utils = require( "../lib/utils" );
const updateLambda = require( "../lib/deploy-lambda/updateLambda" );
const scheduledEvent = require( "../lib/deploy-lambda/scheduledEvent" );

describe( "colly deploy-lambda", () => {

	describe( "updateLambda.js", () => {

		describe( "configShouldBeUpdated function, Environment variables", () => {


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