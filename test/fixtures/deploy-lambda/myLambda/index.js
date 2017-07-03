const foo = require( "./lib/foo" );
const bar = require( "../shared-lib/bar" );

exports.handler = function ( event, context, callback ) {
	console.log( "hello" );
}