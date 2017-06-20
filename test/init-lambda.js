const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const fs     = require('fs-extra')

const initLambda = require( "../lib/init-lambda" );
 
const newLambdaPath = `${process.cwd()}/test-init-lambda`;

function getFile ( path ) {
	return fs.readFileSync( path ).toString().trim()
}

describe( "colly init-lambda", () => {

	before( () => {
		fs.removeSync( newLambdaPath );
	});

	after( () => {
		fs.removeSync( newLambdaPath );
	});

	it( "should create a new directory with the right stuff in it", ( done ) => {

		initLambda( "test-init-lambda" )
			.then( ( response ) => {
				expect( response ).to.equal( "Lambda \"test-init-lambda\" created!" );
				expect( getFile( `${newLambdaPath}/index.js`      ) ).to.equal( getFile( "./test/fixtures/init-lambda/index.js"      ) );
				expect( getFile( `${newLambdaPath}/function.json` ) ).to.equal( getFile( "./test/fixtures/init-lambda/function.json" ) );
				done();
			})
			.catch( () => {
				assert.fail();
				done();
			});

	});

	it( "should return an error if the directory already exists", ( done ) => {

		initLambda( "test-init-lambda" )
			.then( ( response ) => {
				assert.fail( "actual", "expected" );
				done();
			})
			.catch( ( response ) => {
				expect( response ).to.equal( "Lambda \"test-init-lambda\" already exists" );
				done();
			});

	});

});
