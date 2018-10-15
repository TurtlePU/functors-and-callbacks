# Functors and Callbacks

This is a js lib for building asynchronous pipelines / full algorithms
Without callback hell, of course.

There are three main classes:

1. **LinearWrapper** &mdash; analog of sequential operations. Works nearly the same as Promise, I guess.
2. **SwitcherWrapper** &mdash; as you see, names of classes are quite descriptive. This is analog of 'switch' operator.
3. **CyclicWrapper** &mdash; obviously, this time it's cycles.

Each of them works in the similar pattern, which you'll understand a bunch of lines later.
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
)
```

No callback hell, as I promised.

LinearWrapper is constructed like that:

```javascript
var wrap = new LinearWrapper(
    func,
    wait,
    ...argsF
);
```

where ```func``` is any object that does something if called with ```()```, ```wait``` &mdash; a Boolean flag which tells if ```func``` has a callback, ```argsF``` &mdash; any arguments for ```func``` that you know now and want them to be passed first.

Then you can add next operations using ```wrap.andThen()```, passing them in the same way as above:

```javascript
wrap.andThen(
    () => console.log('Meow!')
).andThen(
    (meal) => console.log('I love ' + meal),
    false,
    'cookies'
);
```

Note that you can queue as much as you want in one expression &mdash; ```.andThen()``` returns the same Wrapper it was invoked on.
And, of course, you can omit everything except functional object for code readability. (omitted waitF will be interpreted as false, and there will be no preset arguments)

After you've done with queueing, you can execute all those operations calling ```.apply()``` or simply ```()```, just like it's a function:

```javascript
var cookiesAndStuff = new LinearWrapper(
    (author, message, time, next) => {
        setTimeout(() => {
            console.log(author + ': ' + message);
            next();
        }, time);
    },
    true,
    'Vader',
    'I love cookies'
).andThen(
    () => {
        return "Why do I have to return anything?";
    }
).andThen(
    (argument) => console.log(argument);
);

cookiesAndStuff.apply(1000); //instead of '.apply(1000)' there could be simply '(1000)'
```

Whoa, wait. What is ```next```? Where does the first operation take its ```time```? Why is there more than one argument after ```true```? Where does the return from the second operation go? Where does the last operation take its ```argument```? Why do we pass ```1000``` in apply?

Hold on, there are the answers. But we'll begin from the end.

1. ```.apply()``` arguments

   All of them are passed to the first operation right after its preset arguments (```argsF```, remember?). So this weird ```1000``` is interpreted as ```time``` in first operation.

2. ```.andThen()``` multiple arguments

   During writing this lib, I tried to use spread operator as much as I could to make the code using this lib as readable as possible. So, as you can guess, all arguments of ```.andThen()``` after ```wait``` are collected and interpreted as ```...argsF```. So, ```'Vader'``` and ```'I love cookies'``` will be ```author``` and ```message```.

3. Callback function as an operation

   If you want a callback function in your Wrapper queue, it must match only one additional requirement &mdash; it must accept the next operation in queue as its last argument. So, in this case, the second operation will be passed to the first as ```next```.

4. Return from the operations

   Huh, that's easy. If operation returns anything and does not have a callback, anything it returns will be passed to the next operation right after any preset arguments. In this case, ```"Why do I have to return anything?"``` will be the ```argument``` of the last operation.

Not that hard, I hope.

Ah, almost forgot. ```.apply()``` returns the return of the first callback (or the last functor in queue, if there are no callbacks).

## Switcher

On construction of ```SwitcherWrapper``` object you pass only the info about the "root" functor &mdash; the one which result will be used for switch:

```javascript
let switcher = new SwitcherWrapper(
    choose_your_fate,
    true
);
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

switcher.getOption("dark side of Force").andThen(() => console.log("Is this even legal?"));
```

I think you may have some questions. Here are the answers.

1. ```cookiesAndStuff``` as an option

   That's easy-peasy lemon squeezy, my friend. As ```cookiesAndStuff``` is a ```LinearWrapper```, it can be called as a function too. So it can be implemented in other Wrappers (as you'll see, every Wrapper can be put inside any other Wrapper. It's kind of cool, I think).

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

Construction looks like this:

```javascript
let cycleOfLife = new CyclicWrapper(
    {
        p: function writeDocs_notif(docsReady) { return !docsReady; },
        waitP: false,  // redundant here
        argsP: []  // redundant here
    },
    {
        f: function writeDocs(linesWritten, linesNeeded) {
            return {
                toPredicate: [linesWritten >= linesNeeded],
                toFunctor: [linesWritten + 1, linesNeeded]
            };
        },
        waitF: false,  // redundant here
        argsF: []  // redundant here
    }
);
```

If you need to change a predicate (the condition of a cycle), you should call ```.setPredicate(predicate, waitP, ...argsP)```. Same with ```.setFunctor(functor, waitF, ...argsF)``` (the body of a cycle).

Apply:

```javascript
cycleOfLife(0, INF);  // any arguments of .apply() will be passed to the first call of the functor, right after argsF
```

Format of callback / non-callback predicate / functor:

```javascript
let non_clb_predicate = (toPredicate_1, toPredicate_2, ..., toPredicate_n) => {  // on first iteration --- ...argsP
    // do some stuff
    if (keep_going)
        return true;
    else
        return false;
}

let clb_predicate = (toPredicate : Array, functor : function) => {
    // do some stuff

    // somewhere in a callback
    if (keep_going)
        functor();
}

let non_clb_functor = (toFunctor_1, toFunctor_2, ..., toFunctor_n) {  // on first iteration --- ...(argsF + .apply() arguments)
    // do some stuff
    return {
        // maybe some other fields
        toPredicate : [...]  // next predicate call arguments
        toFunctor : [...]    // same for functor
    }
}

let clb_functor = (toFunctor : Array, predicate_clb : function) => {
    // do some stuff

    // somewhere in a callback
    predicate_clb(
        [...],  // arguments for next predicate call
        [...]   // same for functor
    )
}
```

Yeah, I know, the arguments and returns of functions doesn't match. Don't worry: it works.

## Conclusion

Well, I think, that's it for now. New tools for async are cometh!