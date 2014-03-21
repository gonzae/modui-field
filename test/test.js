var BaseFieldView = require( '../' );

window.myField = new BaseFieldView();

window.myField.setValue( "hello" );

console.log( window.myField.getValue() );