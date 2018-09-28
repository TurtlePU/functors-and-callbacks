function LinearObject(f, wait, ...argsF) {

    var ret = function LinearObject() {
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
 *
 * @kind class
 *
 * @param {function} f first functor in queue
 * @param {Boolean} waitF true if functor f contains a callback, false otherwise
 * @param {...Object} argsF preset params for the functor f
 *
 * If first functor doesn't have a callback, it must match this scheme:
 * * @param {...Object} argsF
 * * @param {...Object} arguments .apply() arguments
 * * @returns {Object} will be given to the next functor as tail argument
 *
 * If first functor has a callback, it must match this scheme:
 * * @param {...Object} argsF
 * * @param {...Object} arguments .apply() arguments
 * * @param {function} next functor
 *
 * @returns {function} so Wrapper object can be used as functor itself
 */
function LinearWrapper(f, waitF, ...argsF) {

    var ret = function LinearWrapper() {
        return ret.apply(...arguments);
    };

    const first = new LinearObject(f, waitF, ...argsF);
      var last  = first;

    /**
     * Method to queue functors.
     *
     * @param {function} g next functor in queue
     * @param {Boolean} waitG true if functor g contains a callback, false otherwise
     * @param {...Object} argsG preset params for the functor g
     *
     * If added functor doesn't have a callback, it must match this scheme:
     * * @param {...Object} argsF
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @returns {Object} will be given to the next functor as tail argument
     *
     * If first functor has a callback, it must match this scheme:
     * * @param {...Object} argsF
     * * @param {Object} tail any result from previous functor (passed in callback or returned from non-callback)
     * * @param {function} next functor
     *
     * @returns {LinearWrapper} this Wrapper
     */
    ret.andThen = function(g, waitG, ...argsG) {
        last = last.setNext(g, waitG, ...argsG);
        return ret;
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
 * Wrapper for "Scenario" operations (switcher). Selects the next functor depending on result from root functor.
 *
 * @kind class
 *
 * @param {function} f root functor
 * @param {Boolean} wait tells whether functor f contains a callback
 * @param {...Object} argsF preset params for the functor f
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
function ScenarioWrapper(f, wait, ...argsF) {

    var ret = function ScenarioWrapper() {
        return ret.apply(...arguments);
    };

    var links = new Map();

    /**
     * Sets selection map.
     *
     * @param {Map} links_map selection map. The value (functor) from map to execute is got by key --- main result (as return or in callback) of root functor
     *
     * Functors which are values of this map must match this scheme:
     * * @param {...Object} args spread of any result (as return or passed in callback) from root functor that comes in pair with key
     * * @returns {Object} anything
     *
     * @returns {ScenarioWrapper} this Wrapper
     */
    ret.setLinks = function(links_map) {
        links = new Map(links_map);
        return ret;
    };

    /**
     * Drops selection map.
     */
    ret.dropLinks = function() {
        links = new Map();
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
    ret.addLink = function(key, functor) {
        links.set(key, functor);
        return ret;
    };

    /**
     * Gets an option functor by key.
     *
     * @param {Object} key main result (as return or passed in callback) of root functor that maps to returned option
     *
     * @returns {function} option functor
     */
    ret.getLink = function(key) {
        return links.get(key);
    };

    /**
     * Removes an option by key.
     *
     * @param {Object} key main result (as return or passed in callback) of root functor that maps to option to delete
     *
     * @returns {Boolean} true if deletion occured, false otherwise
     */
    ret.removeLink = function(key) {
        return links.delete(key);
    };

    /**
     * Applies first functor and the one which executes from the first functor's result. Works the same as function returned from constructor.
     *
     * @param {...Object} arguments launch arguments
     *
     * @returns {Object} a return from the first executed functor with callback (or last if none has callback)
     */
    ret.apply = function() {
        if (links.size == 0)
            return f(...argsF, ...arguments);
        if (!wait) {
            let res = f(...argsF, ...arguments);
            return links.get(res.key)(...res.args);
        }
        return f(...argsF, ...arguments, links);
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
 * @param {Object} functorInfo consists of the following (anything except f can be omit):
 * * @param {function} f a functor to be called repeatedly
 * * @param {Boolean} waitF true if functor has a callback, false otherwise
 * * @param {Array} argsF preset arguments for the first call of functor
 *
 * If functor doesn't have a callback, it must match this scheme:
 * * @param {...Object} toFunctor (on first iteration --- argsF + .apply() arguments)
 * * @returns {Object} { toPredicate: Array, toFunctor: Array } those are the arguments for future iterations
 *
 * If functor has a callback, it must match this scheme:
 * * @param {Array} toFunctor (on first iteration --- argsF + .apply() arguments)
 * * @param {function} predicate_clb predicate based on predicate from this Wrapper
 * Note: it must pass arguments for future iterations (toPredicate, toFunctor) to the predicate_clb in given order as arrays as 2 arguments on finish of callback execution
 *
 *
 * @param {Object} predicateInfo consists of the following (anything except p can be omit):
 * * @param {function} p a predicate. Must return true if continue cycle, false otherwise
 * * @param {Boolean} waitP true if predicate has a callback, false otherwise
 * * @param {Array} argsP preset arguments for the first call of predicate
 *
 * If predicate doesn't have a callback, it must match this scheme:
 * * @param {...Object} toPredicate (on first iteration --- argsP)
 * * @returns {Boolean} true if keep iterating, false otherwise
 *
 * If predicate has a callback, it must match this scheme:
 * * @param {Array} toPredicate (on first iteration --- argsP)
 * * @param {function} functor_clb functor with no arguments based on functor from this Wrapper. Call it on finish of callback execution, if iteration continues
 *
 *
 * @returns {function} function so Wrapper can be used as functor itself
 */
function CyclicWrapper(functorInfo, predicateInfo) {

    var f     = functorInfo.f,
        waitF = functorInfo.waitF || false,
        argsF = functorInfo.argsF || [];

    var p     = predicateInfo.p,
        waitP = predicateInfo.waitP || false,
        argsP = predicateInfo.argsP || [];

    var ret = function CyclicWrapper() {
        return ret.apply(...arguments);
    };

    /**
     * Sets new functor.
     *
     * @param {function} new_f new functor
     * @param {Boolean} new_waitF true if new functor has a callback, false otherwise
     * @param {...Object} new_argsF preset arguments for the first call of new functor
     *
     * If new functor doesn't have a callback, it must match this scheme:
     * * @param {...Object} toFunctor (on first iteration --- new_argsF + .apply() arguments)
     * * @returns {Object} { toPredicate: Array, toFunctor: Array } those are the arguments for future iterations
     *
     * If new functor has a callback, it must match this scheme:
     * * @param {Array} toFunctor (on first iteration --- new_argsF + .apply() arguments)
     * * @param {function} predicate_clb predicate based on predicate from this Wrapper
     * Note: it must pass arguments for future iterations (toPredicate, toFunctor) to the predicate_clb in given order as arrays as 2 arguments on finish of callback execution
     *
     * @returns {CyclicWrapper} this Wrapper
     */
    ret.setFunctor = function(new_f, new_waitF, ...new_argsF) {
        { f, waitF, argsF } = { new_f, new_waitF, new_argsF };
        return ret;
    };

    /**
     * Sets new predicate.
     *
     * @param {function} new_p new predicate
     * @param {Boolean} new_waitP true if new predicate has a callback, false otherwise
     * @param {...Object} new_argsP preset arguments for the first call of new predicate
     *
     * If new predicate doesn't have a callback, it must match this scheme:
     * * @param {...Object} toPredicate (on first iteration --- new_argsP, result from functor on following iterations)
     * * @returns {Boolean} true if keep iterating, false otherwise
     *
     * If new predicate has a callback, it must match this scheme:
     * * @param {Array} toPredicate (on first iteration --- new_argsP, result from functor on following iterations)
     * * @param {function} functor_clb functor with no arguments based on functor from this Wrapper. Call it on finish of callback execution, if iteration continues
     *
     * @returns {CyclicWrapper} this Wrapper
     */
    ret.setPredicate = function(new_p, new_waitP, ...new_argsF) {
        { p, waitP, argsP } = { new_p, new_waitP, new_argsP };
        return ret;
    };

    /**
     * Applies functor as long as predicate returns true. Works the same as function returned from constructor.
     *
     * @param {...Object} arguments launch arguments for functor
     *
     * @returns {Object} a pair which is returned from last execution of functor or null if at least one of functions have callbacks
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

if (module)
    module.exports = {
        LinearWrapper: LinearWrapper,
        ScenarioWrapper: ScenarioWrapper,
        CyclicWrapper: CyclicWrapper
    };
