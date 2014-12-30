# modui-field

modui-field is an abstract class that is extended to provide a consistent interface for getting, setting, and validating values of modui components. Imagine we have a form that contains name, age, and locationn fields. If all our fields extend modui-field, setting the values of the fields in the form is as easy as:

```javascript
$( '.my-form' ).moduiField( 'set', {
	name : 'John Elliot',
	age : 33,
	location : {
		street : '23 Monkey Road'
		city : 'Ubud',
		state : 'Gianyar',
		country : 'Bali'
	}
} );
```

Field values can be any type. They can even be composed of smaller values that correspond to sub-fields, as is the "location" value in the above example. modui-field has built in support for sub-fields with getting, setting, and validating values.

## Methods

### Methods that generally do not need to be overridden by derived classes.

#### `field.getValue( options )`

Return the current value of the field. If `immediate : true` is in options, the value returned is pulled directly from the representation of the field's value that resides in the DOM (via `field._pullValue()`). The option can be used to pull the current value from a text field that is currently being edited.

#### `field.setValue( newValue, options )`

Set the current value of the field. If `newValue` is not the same as the current value, a `change` message is spawned using [Backbone.Courier](https://github.com/rotundasoftware/backbone.courier) (unless `slient : true` is supplied in the options hash).

#### `field.attemptSubmit()`

// Documentation needs to be written

#### `field._processValueChange()`

This private method should be called internally whenever the representation of the field's value that resides in the DOM is potentially changed. For example, in the context of a text field, this method would be called on blur, since the representation of the fields value that resides in the DOM (that is, the string inside the input field) may have changed.

`field._processValueChange()` performs validation on the value in the DOM by calling `field._coerceToValidValue()`. If the value is valid or can be coerced to be valid, then `field.setValue()` is called with the new value. Otherwise, the representation of the field value in the DOM is reset to its last valid state.

### Methods that generally should be overridden by derived classes

#### `field._pullValue()`

This private method should return the representation of the field's value that resides in the DOM. For example, a text field might return the value of the input element by calling `this.$el.val()`. The value returned does not need to be a valid value as it will always pass through `field._coerceToValidValue()` before being used.

#### `field._pushValue( value )`

The inverse of `field.pullValue()`, this method should push `value` to the representation of the field's value that resides in the DOM. For example, a text field might call `this.$el.val( value )` to set the value of its input element. `value` is guaranteed to be a valid value since it will have passed through `field._coerceToValidValue()`.

#### `field._coerceToValidValue( sketchyValue )`

This method transforms a potentially invalid value into a valid value. For example, an integer field might return `Math.round( sketchyValue )` because its value can only be an integer. In the case that `sketchyValue` can not be transformed into a valid value, this method should return `undefined`.

#### `field.getFormErrors()`

This method should examine `field.value` and return an array of form errors. Form errors are those problems with the current value that should prevent a form that contains this field from being submitted. For example, a text field might an error object in the case that the current value exceeds its `maxLength` option. (Note it is not necessary to check for an invalid value, since `field._coerceToValidValue()` always protects the field from having an invalid value.)

#### `field.showFormErrors( errors )`

This method takes an array of form errors, as returned by `field.getFormErrors()`, and should manipulate the DOM to show visual cues that indicate to the end user those errors are present. For example, the default behavor is to toggle a `has-form-errors` class on the field element, which results in the color of the field being displayed in `red`.

