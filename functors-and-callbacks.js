function LinearObject(f, wait, ...argsF) {
	var ret = function() {
		return ret.apply(...arguments);
	};

	var next;

	ret.setNext = function(g, w, ...argsG) {
		return next = new LinearObject(g, w, ...argsG);
	};

	ret.apply = function() {
		if (!next)
			return f(...argsF, ...arguments);
		if (!wait)
			return next.apply(f(...argsF, ...arguments));
		return f(...argsF, ...arguments, next);
	};

	return ret;
};

/**
 * Wrapper for "Linear" operations. Queues functors one after another.
 * Arguments of functors w/out callbacks must be the following: ([...prearranged], [last]), where 'last' is return from previous functor (or launch arguments, if first)
 * Arguments of functors with callbacks must be the following: ([...prearranged], [last], [next]), where 'next' is next functor
 * @kind class
 * @param {functor} f first functor in queue
 * @param {Boolean} wait tells whether functor f contains a callback
 * @param {...Object} argsF preset params for the functor f
 * @returns {function} function so Wrapper object can be used as functor itself
 */
function LinearWrapper(f, wait, ...argsF) {
	var ret = function() {
		return ret.apply(...arguments);
	};

	const first = new LinearObject(f, wait, ...argsF);
	  var last  = first;

	/**
	 * Method to queue functors
	 * @param {functor} g next functor in queue
	 * @param {Boolean} w tells whether functor g contains a callback
	 * @param {...Object} argsG preset params for the functor g
	 * @returns {LinearWrapper} this Wrapper
	 */
	ret.andThen = function(g, w, ...argsG) {
		last = last.setNext(g, w, ...argsG);
		return ret;
	};

	/**
	 * Method to apply all the queued functors. Works the same as function returned from constructor.
	 * @param {...Object} arguments launch arguments ('last' for the first functor)
	 * @returns {Object} return from the last functor\
	 */
	ret.apply = function() { return first.apply(...arguments); };

	return ret;
};

/**
 * Wrapper for "Scenario" operations (switcher). Selects the next functor depending on result from first one.
 * Arguments for first functor must be the following: ([...prearranged], [...launch], [map]), where map is selection map (if first functor contains a callback)
 * If first functor doesn't have a callback, it must return an Object which is pair of Key and nextArgs, where Key is key of next functor and nextArgs (which is Array) are given to next functor
 * @kind class
 * @param {functor} f first functor
 * @param {Boolean} wait tells whether functor f contains a callback
 * @param {...Object} argsF preset params for the functor f
 * @returns {function} function so Wrapper object can be used as functor itself
 */
function ScenarioWrapper(f, wait, ...argsF) {
	var ret = function() {
		return ret.apply(...arguments);
	};
		
	var links = new Map();

	/**
	 * Sets selection map
	 * functors which are values of this map must accept ...nextArgs (a spread of Array), and nextArgs is the second elem from the pair returned by first functor
	 * @param {Map} links_map selection map. The value (functor) from map is called if the key equals to the first elem from the return value of first functor
	 * @returns {ScenarioWrapper} this Wrapper
	 */
	ret.setLinks = function(links_map) {
		links = new Map(links_map);
		return ret;
	};

	/**
	 * Drops selection map
	 * @returns {ScenarioWrapper} this Wrapper
	 */
	ret.dropLinks = function() {
		links = new Map();
		return ret;
	};

	/**
	 * Adds new option
	 * @param {Object} key a result that must be returned from first functor in order to execute this option
	 * @param {functor} functor the option itself
	 * @returns {ScenarioWrapper} this Wrapper
	 */
	ret.addLink = function(key, functor) {
		links.set(key, functor);
		return ret;
	};

	/**
	 * Gets an option functor by key
	 * @param {Object} key result that must be returned from first functor in order to execute this option
	 * @returns {Object} a pair of this Wrapper and option functor
	 */
	ret.getLink = function(key) {
		return { wrapper: ret, ret: links.get(key) };
	};

	/**
	 * Removes an option by key
	 * @param {Object} key result that would execute this option if it was reached by return from first functor
	 * @returns {Object} a pair of this Wrapper and Boolean, which tells whether deletion occured
	 */
	ret.removeLink = function(key) {
		return { wrapper: ret, ret: links.delete(key) };
	};

	/**
	 * Applies first functor and the one which executes from the first functor's result. Works the same as function returned from constructor.
	 * @param {...Object} arguments launch arguments
	 * @returns {Object} a return from the last executed functor
	 */
	ret.apply = function() {
		if (links.size == 0)
			return f(...argsF, ...arguments);
		if (!wait) {
			let { next, argsNext } = f(...argsF, ...arguments);
			return links.get(next)(...argsNext);
		}
		return f(...argsF, ...arguments, links);
	};

	return ret;
};

//TODO: rewrite CyclicWrapper considering callbacks

/**
 * Wrapper for Cyclic operations. Repeats functor as long as predicate returns true.
 * Functor must accept the following: ([...argsF], [...arguments]) on first iteration, and spread of second elem from its own return on the following iterations
 * Predicate must accept [] on first check, and the first elem from the return of functor on the following checks
 * @kind class
 * @param {functor} functor a functor to be executed repeatedly
 * @param {predicate} predicate a predicate to check whether to continue cycling
 * @param {...Object} argsF any preset arguments for functor
 * @returns {function} function so Wrapper can be used as functor itself
 */
function CyclicWrapper(functor, waitF, predicate, waitP, ...argsF) {
	var ret = function() {
		return ret.apply(...arguments);
	};

	functor = functor || ( () => {} );
	predicate = predicate || ( () => false );

	/**
	 * Applies functor as long as predicate returns true
	 * @param {...Object} arguments any additional arguments for functor
	 * @returns {Object} a pair which is returned from last execution of functor
	 */
	ret.apply = function() {
		var obj = { toPredicate: [], toFunctor: (argsF || []) + (arguments || []) };
		while (predicate(...obj.toPredicate))
			obj = functor(...obj.toFunctor);
		return obj;
	};

	return ret;
};

if (module)
	module.exports = {
		LinearWrapper: LinearWrapper,
		ScenarioWrapper: ScenarioWrapper,
		CyclicWrapper: CyclicWrapper
	};
