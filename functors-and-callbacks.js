function __fill_with_default(info) {
    return {
        f    : info.f,
        wait : info.wait !== false,
        args : info.args || []
    };
};

function LinearObject(functorInfo) {
    const { f, wait, args } = __fill_with_default(functorInfo);

    var ret = function LinearObject() {
        return ret.apply(...arguments);
    };

    var next;

    ret.getNext = function() { return next; }
    ret.getInfo = function() { return { f : f, wait : wait, args : args }; }

    ret.setNext = function(nextObject) {
        return next = nextObject;
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
 *
 * @kind class
 *
 * @param {Object} functorInfo consists of the following:
 * * @param {function} f first functor in queue
 * * @param {Boolean} wait true if functor f contains a callback, false otherwise (defaults to true)
 * * @param {Array} args preset params for the functor f (defaults to [])
 *
 * If first functor doesn't have a callback, it must match this scheme:
 * * @param {...Object} args
 * * @param {...Object} arguments .apply() arguments
 * * @returns {Object} will be given to the next functor as tail argument
 *
 * If first functor has a callback, it must match this scheme:
 * * @param {...Object} args
 * * @param {...Object} arguments .apply() arguments
 * * @param {function} next functor
 *
 * @returns {function} so Wrapper object can be used as functor itself
 */
function LinearWrapper(functorInfo) {

    var ret = function LinearWrapper() {
        return ret.apply(...arguments);
    };

    const first = new LinearObject(functorInfo);
    var   last  = first;

    /**
     * Puts new functor in queue.
     * Note: this function makes source queue longer.
     * * To make copy of queue and make copy longer, use .andThenNoAssign()
     *
     * @param {Object} functorInfo consists of the following:
     * * @param {function} f next functor in queue
     * * @param {Boolean} wait true if functor f contains a callback, false otherwise (defaults to true)
     * * @param {Array} args preset params for the functor f (defaults to [])
     *
     * If added functor doesn't have a callback, it must match this scheme:
     * * @param {...Object} args
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @returns {Object} will be given to the next functor as tail argument
     *
     * If first functor has a callback, it must match this scheme:
     * * @param {...Object} args
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @param {function} next functor
     *
     * @returns {LinearWrapper} this Wrapper
     */
    ret.andThen = function(gunctorInfo) {
        last = last.setNext(new LinearObject(gunctorInfo));
        return ret;
    }

    /**
     * Puts new functor in queue.
     * Note: this function doesn't make source queue longer. It copies it and queues next functor into a copy, then returns it.
     * * To make source queue longer, use .andThen()
     *
     * @param {Object} functorInfo consists of the following:
     * * @param {function} f next functor in queue
     * * @param {Boolean} wait true if functor f contains a callback, false otherwise (defaults to true)
     * * @param {Array} args preset params for the functor f (defaults to [])
     *
     * If added functor doesn't have a callback, it must match this scheme:
     * * @param {...Object} args
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @returns {Object} will be given to the next functor as tail argument
     *
     * If first functor has a callback, it must match this scheme:
     * * @param {...Object} args
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @param {function} next functor
     *
     * @returns {LinearWrapper} copy of this Wrapper with next functor
     */
    ret.andThenNoAssign = function(gunctorInfo) {
        var result = new LinearWrapper(functorInfo);

        let tmp = first;
        while (tmp = tmp.getNext())
            result.andThen(tmp.getInfo());

        return result.andThen(gunctorInfo);
    };

    /**
     * Method to apply all the queued functors. Works the same as function returned from constructor.
     *
     * @param {...Object} arguments launch arguments
     *
     * @returns {Object} return from the first callback functor (or from last functor, if none is callback)
     */
    ret.apply = function() { return first.apply(...arguments); };

    return ret;
};

/**
 * Wrapper for "Switcher" operations. Selects the next functor depending on result from root functor.
 *
 * @kind class
 *
 * @param {Object} switcherInfo consists of the following:
 * * @param {function} f switcher function itself
 * * @param {Boolean} wait tells whether switcher f contains a callback (defaults to true)
 * * @param {Array} args preset params for the switcher f (defaults to [])
 *
 * If first functor doesn't have a callback, it must match this scheme:
 * * @param {...Object} argsF
 * * @param {...Object} arguments .apply() arguments
 * * @returns {Object} { key: Object, args: Array } the next functor will be got by key and given the ...args as arguments
 *
 * If first functor has a callback, it must match this scheme:
 * * @param {...Object} argsF
 * * @param {...Object} arguments .apply() arguments
 * * @param {Map} map from keys (possible outcomes of root functor execution) to next functor variations
 *
 * @returns {function} so Wrapper object can be used as functor itself
 */
function SwitcherWrapper(switcherInfo) {
        const { f, wait, args } = __fill_with_default(switcherInfo);

    var ret = function SwitcherWrapper() {
        return ret.apply(...arguments);
    };

    var options = new Map();

    /**
     * Sets option map.
     *
     * @param {Map} option_map
     * * Option map.
     * * The value (functor) from map to execute is got by key --- main result (as return or in callback) of root functor
     *
     * Functors which are values of this map must match this scheme:
     * * @param {...Object} args spread of any result (as return or passed in callback) from root functor that comes in pair with key
     * * @returns {Object} anything
     *
     * @returns {ScenarioWrapper} this Wrapper
     */
    ret.setOptions = function(option_map) {
        options = new Map(option_map);
        return ret;
    };

    /**
     * Drops option map.
     */
    ret.dropOptions = function() {
        options = new Map();
    };

    /**
     * Adds new option.
     *
     * @param {Object} key main result (as return or in callback) of root functor that should map to new option
     * @param {function} functor the option itself
     *
     * Functor must match this scheme:
     * * @param {...Object} args spread of any result (as return or passed in callback) from root functor that comes in pair with key
     * * @returns {Object} anything
     *
     * @returns {ScenarioWrapper} this Wrapper
     */
    ret.addOption = function(key, functor) {
        options.set(key, functor);
        return ret;
    };

    /**
     * Gets an option functor by key.
     *
     * @param {Object} key main result (as return or passed in callback) of root functor that maps to returned option
     *
     * @returns {function} option functor
     */
    ret.getOption = function(key) {
        return options.get(key);
    };

    /**
     * Removes an option by key.
     *
     * @param {Object} key main result (as return or passed in callback) of root functor that maps to option to delete
     *
     * @returns {Boolean} true if deletion occured, false otherwise
     */
    ret.removeOption = function(key) {
        return options.delete(key);
    };

    /**
     * Applies first functor and the one which is mapped from the first functor's result.
     * Works the same as function returned from constructor.
     *
     * @param {...Object} arguments launch arguments
     *
     * @returns {Object} a return from the first executed functor with callback (or last if none has callback)
     */
    ret.apply = function() {
        if (links.size == 0) {
            return f(...args, ...arguments);
        } else if (!wait) {
            let res = f(...args, ...arguments);
            return links.get(res.key)(...res.args);
        } else {
            return f(...args, ...arguments, links);
        }
    };

    return ret;
};

/**
 * Wrapper for Cyclic operations. Repeats functor as long as predicate returns true.
 *
 *
 * @kind class
 *
 *
 * @param {Object} predicateInfo consists of the following (anything except f can be omit):
 * * @param {function} f a predicate. Must return true if continue cycle, false otherwise
 * * @param {Boolean} wait true if predicate has a callback, false otherwise (defaults to true)
 * * @param {Array} args preset arguments for the first call of predicate (defaults to [])
 *
 * If predicate doesn't have a callback, it must match this scheme:
 * * @param {...Object} toPredicate (on first iteration --- ...predicateInfo.args)
 * * @returns {Boolean} true if keep iterating, false otherwise
 *
 * If predicate has a callback, it must match this scheme:
 * * @param {Array} toPredicate (on first iteration --- ...predicateInfo.args)
 * * @param {function} functorF functor with no arguments based on functor from this Wrapper.
 * * * Call functorF on finish of callback execution, if iteration continues
 *
 *
 * @param {Object} functorInfo consists of the following (anything except f can be omit):
 * * @param {function} f a functor to be called repeatedly
 * * @param {Boolean} wait true if functor has a callback, false otherwise (defaults to true)
 * * @param {Array} args preset arguments for the first call of functor (defaults to [])
 *
 * If functor doesn't have a callback, it must match this scheme:
 * * @param {...Object} toFunctor (on first iteration --- ...functorInfo.args + .apply() arguments)
 * * @returns {Object} { toPredicate: Array, toFunctor: Array } those are the arguments for future iterations
 *
 * If functor has a callback, it must match this scheme:
 * * @param {Array} toFunctor (on first iteration --- ...functorInfo.args + .apply() arguments)
 * * @param {function} predicateP predicate based on predicate from this Wrapper
 * Note: it must pass arguments for future iterations (toPredicate, toFunctor)
 * * to the predicateP in given order as arrays as 2 arguments on finish of callback execution
 *
 *
 * @returns {function} function so Wrapper can be used as functor itself
 */
function CyclicWrapper(predicateInfo, functorInfo) {

    var { p, waitP, argsP } = __fill_with_default(predicateInfo);
    var { f, waitF, argsF } = __fill_with_default(  functorInfo);

    var ret = function CyclicWrapper() {
        return ret.apply(...arguments);
    };

    /**
     * Sets new predicate.
     *
     * @param {Object} predicateInfo consists of the following:
     * @param {function} f new predicate
     * @param {Boolean} wait true if new predicate has a callback, false otherwise (defaults to true)
     * @param {Array} args preset arguments for the first call of new predicate (defaults to [])
     *
     * If new predicate doesn't have a callback, it must match this scheme:
     * * @param {...Object} toPredicate (on first iteration --- new args, result from functor on following iterations)
     * * @returns {Boolean} true if keep iterating, false otherwise
     *
     * If new predicate has a callback, it must match this scheme:
     * * @param {Array} toPredicate (on first iteration --- new args, result from functor on following iterations)
     * * @param {function} functorF functor with no arguments based on functor from this Wrapper.
     * * * Call functorF on finish of callback execution, if iteration continues
     *
     * @returns {CyclicWrapper} this Wrapper
     */
    ret.setPredicate = function(predicateInfo) {
        { p, waitP, argsP } = __fill_with_default(predicateInfo);
        return ret;
    };

    /**
     * Sets new functor.
     *
     * @param {Object} functorInfo consists of the following:
     * @param {function} f new functor
     * @param {Boolean} wait true if new functor has a callback, false otherwise (defaults to true)
     * @param {Array} args preset arguments for the first call of new functor (defaults to [])
     *
     * If new functor doesn't have a callback, it must match this scheme:
     * * @param {...Object} toFunctor (on first iteration --- new args + .apply() arguments)
     * * @returns {Object} { toPredicate: Array, toFunctor: Array } those are the arguments for future iterations
     *
     * If new functor has a callback, it must match this scheme:
     * * @param {Array} toFunctor (on first iteration --- new args + .apply() arguments)
     * * @param {function} predicateP predicate based on predicate from this Wrapper
     * Note: it must pass arguments for future iterations (toPredicate, toFunctor)
     * * to the predicateP in given order as arrays as 2 arguments on finish of callback execution
     *
     * @returns {CyclicWrapper} this Wrapper
     */
    ret.setFunctor = function(functorInfo) {
        { f, waitF, argsF } = __fill_with_default(functorInfo);
        return ret;
    };

    /**
     * Applies functor as long as predicate returns true. Works the same as function returned from constructor.
     *
     * @param {...Object} arguments launch arguments for functor
     *
     * @returns {Object} an object which is returned from last execution of functor or null if at least one of functions have callbacks
     */
    ret.apply = function() {
        if (!waitF && !waitP) {
            var obj = {
                toPredicate: argsP,
                toFunctor: (argsF || []) + (arguments || [])
            };
            while (p(...obj.toPredicate))
                obj = f(...obj.toFunctor);
            return obj;
        }

        var packedP;
        if (!waitF) {
            packedP = (toPredicate, toFunctor) => {
                p(toPredicate, () => {
                    var obj = f(...toFunctor);
                    packedP(obj.toPredicate, obj.toFunctor);
                });
            };
        } else if (!waitP) {
            packedP = (toPredicate, toFunctor) => {
                if (p(...toPredicate))
                    f(toFunctor, packedP);
            };
        } else {
            packedP = (toPredicate, toFunctor) => {
                p(toPredicate, () => {
                    f(toFunctor, packedP);
                });
            };
        }
        packedP(argsP, argsF + arguments);
    };

    return ret;
};

/**
 * Collector of callback operations
 *
 * @kind function
 *
 * @param {...Object} callbacks callback operations to be collected
 *
 * Note: callbacks must accept only one argument which is a function that should be called on finish of each callback
 *
 * @returns callback function with only one parameter --- next function to execute after the completion of all callbacks
 */
function collectCallbacks(...callbacks) {
    return (next) => {
        let tasksCount = 0;
        let resultsCollected = [];
        callbacks.forEach((task) => task((...results) => {
            resultsCollected += results;
            if (++tasksCount == callbacks.size())
                next(...resultsCollected);
        }));
        if (callbacks.size() == 0)
            next();
    };
};

if (module)
    module.exports = {
        LinearWrapper: LinearWrapper,
        ScenarioWrapper: ScenarioWrapper,
        CyclicWrapper: CyclicWrapper,
        collectCallbacks: collectCallbacks
    };
