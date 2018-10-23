# Functors and Callbacks

This is a js lib for building asynchronous pipelines / full algorithms.

Without callback hell, of course.

There are three main classes:

1. **LinearWrapper** &mdash; analog of sequential operations. Works nearly the same as ```Promise```, I guess.
2. **SwitcherWrapper** &mdash; as you see, names of classes are quite descriptive. This is analog of 'switch' operator.
3. **CyclicWrapper** &mdash; obviously, this time it's cycles.

And one useful function:

1. **collectCallbacks** &mdash; proceeds to continue only after all the callback functions passed into it have completed.

Each of classes works in the similar pattern, which you'll understand a bunch of lines later.
Let's take a closer look on each of them.

## Linear

The most simple one. On construction, you pass the first operation which needs to be executed, and then add any following actions, so it looks like that:

```javascript
LinearWrapper(
    ...
).andThen(
    ...
).andThen(
    ...
);
```

No callback hell, as I promised.

LinearWrapper is constructed like that:

```javascript
var wrap = new LinearWrapper({
    f: () => {...},
    wait: false,
    args: [...]
});
```

where ```f``` is any object that does something if called with ```()```, ```wait``` &mdash; a ```Boolean``` flag which tells if ```f``` has a callback (defaults to ```true```), ```args``` &mdash; any arguments for ```f``` that you know now and want them to be passed first (defaults to ```[]```).

Then you can add next operations using ```wrap.andThen()```, passing them in the same way as above:

```javascript
wrap.andThen({
    f: () => console.log('Meow!'),
    wait: false,
}).andThen({
    f: (meal) => console.log('I love ' + meal),
    wait: false,
    args: ['cookies']
});
```

Note that you can queue as much as you want in one expression &mdash; ```.andThen()``` returns the same Wrapper it was invoked on.

After you've done with queueing, you can execute all those operations calling ```.apply()``` or simply ```()```, just like it's a function:

```javascript
var cookiesAndStuff = new LinearWrapper({
    f: (author, message, time, next) => {
        setTimeout(() => {
            console.log(author + ': ' + message);
            next();
        }, time);
    },
    args: ['Vader', 'I love cookies']
}).andThen({
    f: () => { return "Why do I have to return anything?"; },
    wait: false
}).andThen({
    f: (argument) => console.log(argument);
    wait: false
});

cookiesAndStuff.apply(1000); //instead of '.apply(1000)' there could be simply '(1000)'
```

Whoa, wait. What is ```next```? Where does the first operation take its ```time```? Where does the return from the second operation go? Where does the last operation take its ```argument```? Why do we pass ```1000``` in apply?

Hold on, there are the answers. But we'll begin from the end.

1. ```.apply()``` arguments

   All of them are passed to the first operation right after its preset arguments (```args```, remember?). So this weird ```1000``` is interpreted as ```time``` in first operation.

2. Callback function as an operation

   If you want a callback function in your Wrapper queue, it must match only one additional requirement &mdash; it must accept the next operation in queue as its last argument. So, in this case, the second operation will be passed to the first as ```next```.

3. Return from the operations

   Huh, that's easy. If operation returns anything and does not have a callback, anything it returns will be passed to the next operation right after any preset arguments. In this case, ```"Why do I have to return anything?"``` will be the ```argument``` of the last operation.

Not that hard, I hope.

Also, I have got an interesting feature for you: ```.andThenNoAssign()```. This one is a little bit different from simple ```.andThen()```, because it makes a copy of ```LinearWrapper``` and makes this copy longer, not the original ```Wrapper```. So it is possible to do something like:

```javascript
var variant1 = cookiesAndStuff.andThenNoAssign({
    f: () => console.log('Will this one output?'),
    wait: false
});

var variant2 = cookiesAndStuff.andThen({
    f: () => console.log('Or this one?'),
    wait: false
});

cookiesAndStuff(30);
```

Ah, almost forgot. ```.apply()``` returns the return of the first callback (or the last functor in queue, if there are no callbacks).

## Switcher

On construction of ```SwitcherWrapper``` object you pass only the info about the "root" functor &mdash; the one which result will be used for switch:

```javascript
let switcher = new SwitcherWrapper({
    f: choose_your_fate,
    wait: true  // as in previous, it is ambiguous and can be omit
});
```

The arguments are passed in the same way as in ```LinearWrapper```: functor itself, wait flag, and any default arguments for functor (this time, ```choose_your_fate``` is a callback function with no preset arguments. I guess that it waits for client to make some choices, and then should do something depending on the choice).

After you've finished with "root" functor, you should add some options, right?
The best option is to store possible options in a map, which can be accessed via ```SwitcherWrapper```'s interface:

```javascript
switcher.dropOptions();  // if there were any options in switch, they're all gone now

switcher.setOptions(new Map([
    {
        "light side of Force",
        () => console.log("He's just a vanilla Jedi!")
    },
    {
        "dark side of Force",
        cookiesAndStuff
    }
]));  // sets new map of options. All options from before are gone

switcher.addOption(
    "light side of Force",
    () => console.log("Wait. Do they also have cookies?")
);  // adds another option, if there were none by this key before. Else overwrites the entry.

switcher.removeOption("dark side of Force");  // aww, my cookies are gone!

switcher.addOption("dark side of Force", cookiesAndStuff)  // don't worry, I've got it

switcher.getOption("dark side of Force").andThen({ f: () => console.log("Is this even legal?"), wait: false });
```

I think you may have some questions. Here are the answers.

1. ```cookiesAndStuff``` as an option

   That's easy-peasy lemon squeezy, my friend. As ```cookiesAndStuff``` is a ```LinearWrapper```, it can be called as a function too. So it can be implemented in other ```Wrapper```s (so, as you see, every ```Wrapper``` can be put inside any other ```Wrapper```. It's kind of cool, I think).

2. ```.andThen()``` after ```.getOption()```

   Seems like it's nothing to explain here. ```.getOption()``` returns an option by key, which is ```"dark side of Force"``` here. So it will return ```cookiesAndStuff```. And, as you remember, we can always queue a little more functors in our ```LinearWrappers``` using ```.andThen()```.

If everything is understandable (have a nice day) at this point, we can move to the apply of our switcher:

```javascript
switcher();
```

Oh, seems like I forgot something: the format of root functor.

The non-callback one (but why do you need it in first place?):

```javascript
let non_clb = (argF_1, argF_2, ..., argF_n, args_1, args_2, ..., args_m) => {
    // ...
    return {
        // ...
        key: "key_for_option"
        args: [arg_option_1, arg_option_2, ..., arg_option_k]
    };
}
```

And the callback one:

```javascript
let clb = (argF_1, ..., argF_n, args_1, ..., args_m, MAP) => {
    // ...
    {
        // somewhere in callback
        MAP.get("key_for_option")(arg_option_1, arg_option_2, ..., arg_option_k);
    }
}
```

If no options are available or root is callback, ```.apply()``` returns the return of root. Otherwise returns the return of chosen option.

## Cyclic

Construction looks like this (the first object is info about predicate (condition of a cycle), the second &mdash; about functor (body of a cycle)):

```javascript
let cycleOfLife = new CyclicWrapper(
    {
        f: function writeDocs_notif(docsReady) { return !docsReady; },
        wait: false,
        args: []  // redundant here
    },
    {
        f: function writeDocs(linesWritten, linesNeeded) {
            return {
                toPredicate: [linesWritten >= linesNeeded],
                toFunctor: [linesWritten + 1, linesNeeded]
            };
        },
        wait: false,
        args: []  // redundant here?
    }
);
```

If you need to change a predicate, you should call ```.setPredicate({ f: predicate, wait: waitP, args: [...] })```. Same with ```.setFunctor({ f: functor, wait: waitF, args: [...] })```.

Apply:

```javascript
cycleOfLife(0, INF);  // any arguments of .apply() will be passed to the first call of the functor, right after args
```

Format of callback / non-callback predicate / functor:

```javascript
let non_clb_predicate = (toPredicate_1, toPredicate_2, ..., toPredicate_n) => {  // on first iteration --- ...args for predicate
    // do some stuff
    if (keep_going)
        return true;
    else
        return false;
};

let clb_predicate = (toPredicate : Array, functor : function) => {
    // do some stuff

    // somewhere in a callback
    if (keep_going)
        functor();
};

let non_clb_functor = (toFunctor_1, toFunctor_2, ..., toFunctor_n) {  // on first iteration --- ...('args' for functor + .apply() arguments)
    // do some stuff
    return {
        // maybe some other fields
        toPredicate : [...]  // next predicate call arguments
        toFunctor : [...]    // same for functor
    };
};

let clb_functor = (toFunctor : Array, predicate : function) => {
    // do some stuff

    // somewhere in a callback
    predicate(
        [...],  // arguments for next predicate call
        [...]   // same for functor
    );
};
```

Yeah, I know, the arguments and returns of functions doesn't match. Don't worry: it works.

## collectCallbacks

Ok, this one useful (in comparison to previous three classes).

```collectCallbacks``` takes a spread of functors and returns another callback, which accepts only one argument &mdash; the function to execute after the completion of all callbacks.

That's how it works:

```javascript
var oneBigCallback = collectCallbacks(
    (tail) => cookiesAndStuff.andThen({ f: tail }).apply(1000),
    (tail) => new LinearWrapper({ f: switcher }).andThen({ f: tail }).apply(),
    (tail) => new LinearWrapper({ f: cycleOfLife }).andThen({ f: tail }).apply(0, INF),
    (tail) => {
        console.log('Just a non-callback function. What were you waiting for?');
        tail();
    }
);
```

As you see, each callback function must match a format: it must accept only one argument that's a utility function needed for collector to work. Just call it on the finish of each callback and there will be no problem.

Then, don't forget to call the callback you received:

```javascript
oneBigCallback(() => console.log('Wow, we did it!'));
```

Wow, we did it!

## Conclusion

Well, I think, that's it for now. New tools for async are cometh!