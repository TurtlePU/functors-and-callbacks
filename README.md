# Functors and Callbacks

This is a js lib for building pipelines/full algorithms in functional style with callbacks.
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
And, of course, you can omit everything except functional object for code readability. (omitted waitF will be false, and there will be no preset arguments)

After you've done with queueing, you can execute all those operations calling ```.apply()``` or simply ```()```, just like it's a function:

```javascript
new LinearWrapper(
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
).apply(1000); //instead of '.apply(1000)' there could be simply '(1000)'
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

## Switcher

Pretty straightforward. Switches between options.
//TODO: finish
