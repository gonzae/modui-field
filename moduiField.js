
var _ = require( 'underscore' );
var BaseView = require( 'modui-base' );
var $ = require( 'jquery' );

var FieldView;

module.exports = FieldView = BaseView.extend( {
	className : 'modui-field',

	options : [ 'name', { 'width' : null } ],

	onMessages : {
		'change' : '_processValueChange'
	},

	initialize : function( options ) {
		BaseView.prototype.initialize.apply( this, arguments );

		if( options ) this._value = options.value;

		if( _.isUndefined( this._value ) )
			this._resetValueToDefault( { silent : true } );

		if( this.name ) this.$el.attr( 'data-field-name', this.name );

		this._value = this._coerceToValidValue( this._value );
	},

	render : function() {
		if( this.width === 'stretch' && _.isFunction( this.$el.stretch ) )
			this.$el.stretch();
		else if( this.width )
			this.$el.width( this.width - ( this.$el.innerWidth() - this.$el.width() ) );

		BaseView.prototype.render.apply( this, arguments );
		
		this.$el.data( 'view', this );
		this.$el.attr( 'data-name', this.fieldName );
	},

	setValue : function( originalNewValue, options ) {
		options = _.defaults( {}, options, {
			silent : false
		} );

		var coercedNewValue = this._coerceToValidValue( originalNewValue );
		var valueDidNotChange = true;

		if( ! _.isUndefined( coercedNewValue ) ) {
			valueDidNotChange = _.isEqual( this._value, coercedNewValue );
			this._value = coercedNewValue;
		}

		if( this.$el.children().length > 0 ) {
			// make sure our ui is in sync. If the new value is invalid (in which
			// case this._value is still our old value), or if it needed to be
			// coerced, then we will need to push our new value to the ui.
			
			// note pulling the value here means that when _processValueChange is called we
			// actually do TWO pulls. We could pass this through as an internal option
			// but seems a little weird. There is probably next to no performance
			// hit by pulling the value twice so we'll leave this as-is for now.
			
			if( ! _.isEqual( this._pullValue(), this._value ) ) {
				this._pushValue( this._value );
			}
		}

		if( ! options.silent && ! valueDidNotChange )
			this.spawn( 'change', this._value );

		this.$el.removeClass( 'submit-just-attempted' );
		
		// If this field is currently in an error state, make sure to get rid of that state if we can.
		// That way people see when they have corrected their mistakes immediately. It is important to do
		// this after  the change event is spawned so that any changes made to the UI by other code in response
		// to this change, such as hiding or showing fields, which can impact form errors, are done before we do it.
		if( this.$el.hasClass( 'has-form-errors' ) ) {
			this.showFormErrors( this.getFormErrors() );
		}

		return true;
	},

	getValue : function( options ) {
		options = _.defaults( {}, options, {
			immediate : false
		} );

		if( options.immediate ) return this._coerceToValidValue( this._pullValue() );
		else if( _.isUndefined( this._value ) ) {
			// this is what happens when no default value is specified for a field.
			// the field's value is left undefined until the first attempt to get the
			// value, at which time it is set based on the representation in the ui
			this._value = this._coerceToValidValue( this._pullValue() );
		}

		return _.clone( this._value );
	},

	getFormErrors : function( options ) {
		return [];
	},

	showFormErrors : function( formErrors ) {
		this.$el.toggleClass( 'has-form-errors', formErrors.length > 0 );
	},

	attemptSubmit : function( options ) {
		var _this = this;
		
		options = _.defaults( {}, options, {
			validateHiddenChildren : false
		} );

		var canSubmit = true;

		var childFieldViews = this._getChildFieldViews( { includeHiddenViews : options.validateHiddenChildren } );
		_.each( childFieldViews, function( thisFieldView ) {
			if( ! thisFieldView.attemptSubmit( options ) ) canSubmit = false;
		} );

		var formErrors = this.getFormErrors();
		this.showFormErrors( formErrors );
		if( formErrors.length ) canSubmit = false;

		this.$el.removeClass( 'submit-just-attempted' );
		_.defer( function() { _this.$el.addClass( 'submit-just-attempted' ); } );

		this.submitAttempted = true;

		return canSubmit;
	},

	_resetValueToDefault : function( options ) {
		options = _.defaults( {}, options, { slient : true } );
		
		var newVal;
		if( _.isDate( this.defaultValue ) ) newVal = new Date( this.defaultValue.getTime() );
		else if( _.isObject( this.defaultValue ) ) newVal = _.clone( this.defaultValue );
		else newVal = this.defaultValue;

		this.setValue( newVal, { silent : options.silent } );
	},

	_pullValue : function() {
		var childFieldViews = this._getChildFieldViews();

		var result = {};

		_.each( childFieldViews, function( thisChildFieldView ) {
			result[ thisChildFieldView.name ] = thisChildFieldView.getValue();
		} );

		return result;
	},

	_pushValue : function( value ) {
		var childFieldViews = this._getChildFieldViews();

		_.each( childFieldViews, function( thisChildFieldView ) {
			if( value && ! _.isUndefined( value[ thisChildFieldView.name ] ) )
				thisChildFieldView.setValue( value[ thisChildFieldView.name ], { silent : true } );
			else
				thisChildFieldView._resetValueToDefault( { silent : true } );
		} );
	},

	_coerceToValidValue : function( newValue ) {
		return newValue; // override, return undefined if value no good!
	},

	_onOptionsChanged : function( changedOptions ) {
		// make sure our value is still valid!
		var newValue = this._coerceToValidValue( this._value );
		if( ! _.isUndefined( newValue ) ) this.setValue( newValue );
		else this._resetValueToDefault();

		this.render();
	},

	_onSubviewsRendered : function() {
		// _pushValue needs to go in _onSubviewsRendered, in case additional ui decoration (like
		// initializing jquery ui elements) is performed by descendant classes
		// after calling parent's 'onRender' function. If we just did _pushValue
		// at the end of render() function, that logic would not yet be executed.

		if( ! _.isUndefined( this._value ) )
			this._pushValue( this._value );
	},

	_processValueChange : function() {
		this.setValue( this._pullValue() );
	},

	_getChildFieldViews : function( options ) {
		return _.values( FieldView.find( this.$el.children(), options ) );
	},

	_renderTemplate : function( templateData ) {
		// kind of a hack to let us use both underscore and nunjucks. should probably
		// put this in our base view mixin, once we change base view to be a mixin, that is
		this.$el.html( this.template.render ? this.template.render( templateData ) : this.template( templateData ) );
	}
}, {
	find : function( els, options ) {
		// we used to include the elements themselves in our search, but this was weird
		// for example in the case of dialogs, where this.$el.fieldViews( 'get' ) was
		// resulting in an empty object {} since the dialog itself was being counted.
		// let's try taking the alternate approach and seeing how it goes.
		// var viewElements = els.filter( '.modui-field' );
		var viewElements = $();
		viewElements = viewElements.add( els.find( '.modui-field' ) );

		options = _.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true
		}, options );

		if( ! options.includeHiddenViews ) viewElements = viewElements.filter( ':visible' );

		// get rid of 'sub-modui-fields'.. that is, do not include field views that are children of other field views
		var newViewElements = $( viewElements );
		viewElements.each( function() {
			newViewElements = newViewElements.not( $( this ).find( '.modui-field' ) );
		} );
		viewElements = newViewElements;

		var fieldViews = [];
		var fieldViewsToExclude = [];

		viewElements.each( function() {
			var thisViewEl = $( this );
			var thisFieldViewObject = thisViewEl.data( 'view' );
			if( thisFieldViewObject === undefined || ! thisFieldViewObject instanceof Object ) return false;

			fieldViews.push( thisFieldViewObject );

			if( options.excludeUnavailableDependents &&
				_.isFunction( thisFieldViewObject.getDependentFieldViews ) &&
				thisFieldViewObject.getValue() === false )
					_.each( thisFieldViewObject.getDependentFieldViews(), function( thisDependentFieldView ) {
						fieldViewsToExclude.push( thisDependentFieldView );
					} );
		} );

		fieldViews = _.difference( fieldViews, fieldViewsToExclude );

		return fieldViews;
	},

	get : function( els, options ) {
		options = _.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true,
			excludeFieldsWithFormErrors : false
		}, options );

		var fieldViews = FieldView.find( els, options );
		var valueHash = {};

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;

			if( options.excludeFieldsWithFormErrors && thisFieldView.getFormErrors().length > 0 ) continue;

			if( thisFieldViewIdent ) valueHash[ thisFieldViewIdent ] = thisFieldView.getValue();
		}

		return valueHash;
	},

	set : function( els, suppliedValues, options ) {
		if( suppliedValues === undefined ) throw new Error( 'Undefined hash of values to use for setFields.' );

		options = _.extend( {
			silent : false,
			includeHiddenViews : false,
			resetUnsuppliedValuesToDefaults : true,
			excludeUnavailableDependents : false	// otherwise we might exclude a dependent based on the current value of its 'parent', but we may be changing that value!
		}, options );

		var fieldViews = FieldView.find( els, options );

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;

			if( thisFieldViewIdent ) {
				var newValue = suppliedValues[ thisFieldViewIdent ];

				if( newValue === undefined &&
					options.resetUnsuppliedValuesToDefaults ) {
					thisFieldView._resetValueToDefault( { silent : options.silent } );
				}

				if( newValue !== undefined ) thisFieldView.setValue( newValue, { silent : options.silent } );
			}
		}
	}
} );

$.fn.fieldViews = function( action ) {
	var args = Array.prototype.slice.call( arguments, 1 );
	args.unshift( this );

	var actions = {
		get : FieldView.get,
		set : FieldView.set,
		find : FieldView.find
	};

	return actions[ action ].apply( this, args );
};
