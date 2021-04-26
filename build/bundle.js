
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    function htmlspecialchars(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, function (m) {
            return map[m];
        });
    }

    function read_get() {
        var vars = {};
        window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

    /* src\header.svelte generated by Svelte v3.37.0 */
    const file$4 = "src\\header.svelte";

    // (24:0) {#if visible}
    function create_if_block_1(ctx) {
    	let div;
    	let h4;
    	let t0;
    	let span;
    	let t1;
    	let t2;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h4 = element("h4");
    			t0 = text("Добро пожаловать, ");
    			span = element("span");
    			t1 = text(/*username*/ ctx[0]);
    			t2 = text("!");
    			attr_dev(span, "class", "username_container svelte-1p7xbcj");
    			add_location(span, file$4, 25, 38, 698);
    			attr_dev(h4, "class", "light");
    			add_location(h4, file$4, 25, 2, 662);
    			attr_dev(div, "class", "row center-align");
    			add_location(div, file$4, 24, 0, 592);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h4);
    			append_dev(h4, t0);
    			append_dev(h4, span);
    			append_dev(span, t1);
    			append_dev(h4, t2);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(span, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*username*/ 1) set_data_dev(t1, /*username*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 1000 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 1000 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(24:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (29:0) {#if editmode}
    function create_if_block$3(ctx) {
    	let div2;
    	let div0;
    	let input;
    	let t0;
    	let div1;
    	let button;
    	let div2_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			input = element("input");
    			t0 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Сохранить";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Как к вам обращаться?");
    			add_location(input, file$4, 31, 4, 948);
    			attr_dev(div0, "class", "col s8 m10 l10 input-field");
    			add_location(div0, file$4, 30, 2, 902);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn blue darken-3 waves-effect waves-light saveNameBtn svelte-1p7xbcj");
    			add_location(button, file$4, 34, 4, 1074);
    			attr_dev(div1, "class", "col s4 m2 l2");
    			add_location(div1, file$4, 33, 2, 1042);
    			attr_dev(div2, "class", "row center-align");
    			add_location(div2, file$4, 29, 0, 825);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, input);
    			set_input_value(input, /*newUsername*/ ctx[3]);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[6]),
    					listen_dev(button, "click", /*saveNewName*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*newUsername*/ 8 && input.value !== /*newUsername*/ ctx[3]) {
    				set_input_value(input, /*newUsername*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { y: -100, duration: 400 }, true);
    				div2_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { y: -100, duration: 400 }, false);
    			div2_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching && div2_transition) div2_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(29:0) {#if editmode}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = /*visible*/ ctx[1] && create_if_block_1(ctx);
    	let if_block1 = /*editmode*/ ctx[2] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*editmode*/ ctx[2]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*editmode*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Header", slots, []);
    	let { username = "пользователь" } = $$props;
    	let visible = false;
    	let editmode = false;
    	let newUsername;

    	onMount(() => {
    		$$invalidate(1, visible = true);
    	});

    	function saveNewName() {
    		if (newUsername != undefined && newUsername.length != 0 && newUsername.replace(/ /g, "").length != 0) {
    			localStorage.setItem("username", htmlspecialchars(newUsername));
    			$$invalidate(0, username = newUsername);
    			$$invalidate(2, editmode = false);
    		}
    	}

    	const writable_props = ["username"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(2, editmode = !editmode);

    	function input_input_handler() {
    		newUsername = this.value;
    		$$invalidate(3, newUsername);
    	}

    	$$self.$$set = $$props => {
    		if ("username" in $$props) $$invalidate(0, username = $$props.username);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		fade,
    		fly,
    		htmlspecialchars,
    		username,
    		visible,
    		editmode,
    		newUsername,
    		saveNewName
    	});

    	$$self.$inject_state = $$props => {
    		if ("username" in $$props) $$invalidate(0, username = $$props.username);
    		if ("visible" in $$props) $$invalidate(1, visible = $$props.visible);
    		if ("editmode" in $$props) $$invalidate(2, editmode = $$props.editmode);
    		if ("newUsername" in $$props) $$invalidate(3, newUsername = $$props.newUsername);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		username,
    		visible,
    		editmode,
    		newUsername,
    		saveNewName,
    		click_handler,
    		input_input_handler
    	];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { username: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get username() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set username(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\SearchBar.svelte generated by Svelte v3.37.0 */
    const file$3 = "src\\SearchBar.svelte";

    // (27:0) {#if visible}
    function create_if_block$2(ctx) {
    	let div2;
    	let div1;
    	let input;
    	let t0;
    	let div0;
    	let a0;
    	let t2;
    	let span;
    	let a1;
    	let t4;
    	let a2;
    	let t6;
    	let a3;
    	let t8;
    	let a4;
    	let t10;
    	let a5;
    	let div2_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "Видео";
    			t2 = space();
    			span = element("span");
    			a1 = element("a");
    			a1.textContent = "Расписание";
    			t4 = space();
    			a2 = element("a");
    			a2.textContent = "JS Store";
    			t6 = space();
    			a3 = element("a");
    			a3.textContent = "Вопросы и ответы";
    			t8 = space();
    			a4 = element("a");
    			a4.textContent = "Коллекция обоев";
    			t10 = space();
    			a5 = element("a");
    			a5.textContent = "Блог разработчика";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "searchLine svelte-109ikhx");
    			attr_dev(input, "placeholder", "Начните поиск...");
    			add_location(input, file$3, 29, 6, 632);
    			attr_dev(a0, "href", "https://video.difres.ru");
    			attr_dev(a0, "class", "blue-text");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$3, 31, 8, 806);
    			attr_dev(a1, "href", "https://schedule.difres.ru");
    			attr_dev(a1, "class", "blue-text svelte-109ikhx");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$3, 33, 8, 927);
    			attr_dev(a2, "href", "https://jsstore.difres.ru");
    			attr_dev(a2, "class", "blue-text svelte-109ikhx");
    			attr_dev(a2, "target", "_blank");
    			add_location(a2, file$3, 34, 8, 1022);
    			attr_dev(a3, "href", "https://qna.difres.ru");
    			attr_dev(a3, "class", "blue-text svelte-109ikhx");
    			attr_dev(a3, "target", "_blank");
    			add_location(a3, file$3, 35, 8, 1114);
    			attr_dev(a4, "href", "https://gradientwallpapers.difres.ru");
    			attr_dev(a4, "class", "blue-text svelte-109ikhx");
    			attr_dev(a4, "target", "_blank");
    			add_location(a4, file$3, 36, 8, 1210);
    			attr_dev(a5, "href", "https://blog.difres.ru");
    			attr_dev(a5, "class", "blue-text svelte-109ikhx");
    			attr_dev(a5, "target", "_blank");
    			add_location(a5, file$3, 37, 8, 1320);
    			attr_dev(span, "class", "linksNext svelte-109ikhx");
    			add_location(span, file$3, 32, 8, 893);
    			attr_dev(div0, "class", "left-align servicesLinks svelte-109ikhx");
    			add_location(div0, file$3, 30, 6, 758);
    			attr_dev(div1, "class", "col-content s12 m12 l12");
    			add_location(div1, file$3, 28, 4, 587);
    			attr_dev(div2, "class", "row center-align");
    			add_location(div2, file$3, 27, 2, 509);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, input);
    			set_input_value(input, /*searchText*/ ctx[1]);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(div0, t2);
    			append_dev(div0, span);
    			append_dev(span, a1);
    			append_dev(span, t4);
    			append_dev(span, a2);
    			append_dev(span, t6);
    			append_dev(span, a3);
    			append_dev(span, t8);
    			append_dev(span, a4);
    			append_dev(span, t10);
    			append_dev(span, a5);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keydown", /*startSearch*/ ctx[2], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*searchText*/ 2 && input.value !== /*searchText*/ ctx[1]) {
    				set_input_value(input, /*searchText*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { y: 100, duration: 1000 }, true);
    				div2_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div2_transition) div2_transition = create_bidirectional_transition(div2, fly, { y: 100, duration: 1000 }, false);
    			div2_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching && div2_transition) div2_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(27:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*visible*/ ctx[0] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*visible*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SearchBar", slots, []);
    	let visible = false;
    	const dispatch = createEventDispatcher();
    	let searchText;

    	onMount(() => {
    		$$invalidate(0, visible = true);
    	});

    	function startSearch(e) {
    		if (e.keyCode == 13) {
    			dispatch("startSearch", { text: searchText });
    		}
    	}

    	function readFromGet(query) {
    		$$invalidate(1, searchText = query);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SearchBar> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		searchText = this.value;
    		$$invalidate(1, searchText);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		fly,
    		createEventDispatcher,
    		visible,
    		dispatch,
    		searchText,
    		startSearch,
    		readFromGet
    	});

    	$$self.$inject_state = $$props => {
    		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
    		if ("searchText" in $$props) $$invalidate(1, searchText = $$props.searchText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [visible, searchText, startSearch, readFromGet, input_input_handler];
    }

    class SearchBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { readFromGet: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchBar",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get readFromGet() {
    		return this.$$.ctx[3];
    	}

    	set readFromGet(value) {
    		throw new Error("<SearchBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\SearchResultBlock.svelte generated by Svelte v3.37.0 */

    const file$2 = "src\\SearchResultBlock.svelte";

    function create_fragment$2(ctx) {
    	let div2;
    	let a;
    	let div1;
    	let div0;
    	let span1;
    	let img;
    	let img_src_value;
    	let t0;
    	let span0;
    	let t1;
    	let t2;
    	let span2;
    	let t3;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			a = element("a");
    			div1 = element("div");
    			div0 = element("div");
    			span1 = element("span");
    			img = element("img");
    			t0 = space();
    			span0 = element("span");
    			t1 = text(/*title*/ ctx[0]);
    			t2 = space();
    			span2 = element("span");
    			t3 = text(/*url*/ ctx[2]);
    			if (img.src !== (img_src_value = "https://" + /*icon*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "svelte-ix9k47");
    			add_location(img, file$2, 9, 63, 282);
    			attr_dev(span0, "class", "title svelte-ix9k47");
    			add_location(span0, file$2, 9, 93, 312);
    			attr_dev(span1, "class", "card-title");
    			add_location(span1, file$2, 9, 38, 257);
    			attr_dev(span2, "class", "grey-text");
    			add_location(span2, file$2, 11, 16, 392);
    			attr_dev(div0, "class", "card-content");
    			add_location(div0, file$2, 9, 12, 231);
    			attr_dev(div1, "class", "card hoverable grey lighten-5 svelte-ix9k47");
    			add_location(div1, file$2, 8, 8, 174);
    			attr_dev(a, "href", a_href_value = "https://" + /*url*/ ctx[2]);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$2, 7, 4, 121);
    			attr_dev(div2, "class", "col s12 m12 l12");
    			add_location(div2, file$2, 6, 0, 86);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, a);
    			append_dev(a, div1);
    			append_dev(div1, div0);
    			append_dev(div0, span1);
    			append_dev(span1, img);
    			append_dev(span1, t0);
    			append_dev(span1, span0);
    			append_dev(span0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, span2);
    			append_dev(span2, t3);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*icon*/ 2 && img.src !== (img_src_value = "https://" + /*icon*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*title*/ 1) set_data_dev(t1, /*title*/ ctx[0]);
    			if (dirty & /*url*/ 4) set_data_dev(t3, /*url*/ ctx[2]);

    			if (dirty & /*url*/ 4 && a_href_value !== (a_href_value = "https://" + /*url*/ ctx[2])) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SearchResultBlock", slots, []);
    	let { title } = $$props;
    	let { icon } = $$props;
    	let { url } = $$props;
    	const writable_props = ["title", "icon", "url"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SearchResultBlock> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("icon" in $$props) $$invalidate(1, icon = $$props.icon);
    		if ("url" in $$props) $$invalidate(2, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({ title, icon, url });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("icon" in $$props) $$invalidate(1, icon = $$props.icon);
    		if ("url" in $$props) $$invalidate(2, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, icon, url];
    }

    class SearchResultBlock extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { title: 0, icon: 1, url: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchResultBlock",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !("title" in props)) {
    			console.warn("<SearchResultBlock> was created without expected prop 'title'");
    		}

    		if (/*icon*/ ctx[1] === undefined && !("icon" in props)) {
    			console.warn("<SearchResultBlock> was created without expected prop 'icon'");
    		}

    		if (/*url*/ ctx[2] === undefined && !("url" in props)) {
    			console.warn("<SearchResultBlock> was created without expected prop 'url'");
    		}
    	}

    	get title() {
    		throw new Error("<SearchResultBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<SearchResultBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get icon() {
    		throw new Error("<SearchResultBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<SearchResultBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<SearchResultBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<SearchResultBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    let websites = [
        ['JS Store', 'jsstore.difres.ru'],
        ['DIFRES.RU', 'difres.ru'],
        ['Блог разработчика difres.ru', 'blog.difres.ru'],
        ['Разминка.Счёт', 'count.difres.ru'],
        ['Дневник', 'diary.difres.ru'],
        ['Дневник | JS Store', 'jsstore.difres.ru/product?id=1'],
        ['Разминка.Счёт | JS Store', 'jsstore.difres.ru/product?id=2'],
        ['Вопросы и ответы | QnA DIFRES.RU', 'qna.difres.ru'],
        ['Какие команды нужно прописать в консоли для включения bhop на своем сервере CS:GO? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=1'],
        ['Как открыть диспетчер задач в Windows 10? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=2'],
        ['Как проще запомнить все цвета радуги? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=3'],
        ['Как выдать себе нож на своем сервере CS:GO? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=4'],
        ['GWallpapers | Обои в стиле градиент', 'gradientwallpapers.difres.ru'],
        ['GWallpapers | JS Store', 'jsstore.difres.ru/product.html?id=4'],
        ['Счётчик', 'simplecounter.difres.ru'],
        ['Счётчик | JS Store', 'jsstore.difres.ru/product.html?id=3'],
        ['Как сделать цветной курсор в последних версиях Windows 10? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=5'],
        ['Как подключить JS-файл к HTML-документу? | QnA DIFRES.RU', 'qna.difres.ru/question.html?id=6'],
        ['DIFRES.RU Видео | Видеохостинг', 'video.difres.ru'],
        ['Главная | Расписание', 'schedule.difres.ru'],
        ['Режим просмотра | Расписание', 'schedule.difres.ru/show.html'],
        ['Экспорт расписания | Расписание', 'schedule.difres.ru/export.html'],
        ['Fortnite highlight | First place (#1) | Видео', 'video.difres.ru/watch.html?video=1'],
        ['Fortnite highlight | First place (#2) | Видео', 'video.difres.ru/watch.html?video=2']
    ];

    /* src\SearchResultsContainer.svelte generated by Svelte v3.37.0 */
    const file$1 = "src\\SearchResultsContainer.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (38:0) {#if visible}
    function create_if_block$1(ctx) {
    	let div2;
    	let div0;
    	let h5;
    	let t0;
    	let t1_value = /*results*/ ctx[1].length + "";
    	let t1;
    	let t2;
    	let t3;
    	let div1;
    	let span;
    	let div2_intro;
    	let div2_outro;
    	let t5;
    	let div3;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*results*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			t0 = text("Результаты поиска (");
    			t1 = text(t1_value);
    			t2 = text("):");
    			t3 = space();
    			div1 = element("div");
    			span = element("span");
    			span.textContent = "Скрыть";
    			t5 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h5, "class", "header svelte-n7pafl");
    			add_location(h5, file$1, 40, 12, 1323);
    			attr_dev(div0, "class", "col s8 l10 m10 left-align");
    			add_location(div0, file$1, 39, 8, 1270);
    			attr_dev(span, "class", "blue-text hide-btn svelte-n7pafl");
    			add_location(span, file$1, 43, 12, 1462);
    			attr_dev(div1, "class", "col s4 m2 l2 right-align");
    			add_location(div1, file$1, 42, 8, 1410);
    			attr_dev(div2, "class", "row");
    			add_location(div2, file$1, 38, 4, 1202);
    			attr_dev(div3, "class", "row");
    			add_location(div3, file$1, 46, 4, 1573);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, h5);
    			append_dev(h5, t0);
    			append_dev(h5, t1);
    			append_dev(h5, t2);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, span);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(span, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*results*/ 2) && t1_value !== (t1_value = /*results*/ ctx[1].length + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*websites, results*/ 2) {
    				each_value = /*results*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div3, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div2_outro) div2_outro.end(1);
    				if (!div2_intro) div2_intro = create_in_transition(div2, fly, { y: -200 });
    				div2_intro.start();
    			});

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			if (div2_intro) div2_intro.invalidate();
    			div2_outro = create_out_transition(div2, fly, { y: -200 });
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching && div2_outro) div2_outro.end();
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(38:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (48:8) {#each results as website}
    function create_each_block(ctx) {
    	let div;
    	let searchresultblock;
    	let t;
    	let div_transition;
    	let current;

    	searchresultblock = new SearchResultBlock({
    			props: {
    				title: websites[/*website*/ ctx[4][0]][0],
    				url: websites[/*website*/ ctx[4][0]][1],
    				icon: websites[/*website*/ ctx[4][0]][1].split("/")[0] + "/favicon.png"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(searchresultblock.$$.fragment);
    			t = space();
    			add_location(div, file$1, 48, 12, 1640);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(searchresultblock, div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const searchresultblock_changes = {};
    			if (dirty & /*results*/ 2) searchresultblock_changes.title = websites[/*website*/ ctx[4][0]][0];
    			if (dirty & /*results*/ 2) searchresultblock_changes.url = websites[/*website*/ ctx[4][0]][1];
    			if (dirty & /*results*/ 2) searchresultblock_changes.icon = websites[/*website*/ ctx[4][0]][1].split("/")[0] + "/favicon.png";
    			searchresultblock.$set(searchresultblock_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(searchresultblock.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 200 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(searchresultblock.$$.fragment, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 200 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(searchresultblock);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(48:8) {#each results as website}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*visible*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*visible*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SearchResultsContainer", slots, []);
    	let visible = false;
    	let results = [];

    	function startSearch(query) {
    		$$invalidate(1, results = []);
    		query = query.toLowerCase().split(" ");

    		websites.forEach(function (website, i) {
    			let hits = 0;
    			let keywords = website[0].split(" ");

    			keywords.forEach(function (keyword) {
    				if (["|"].indexOf(keyword) == -1) {
    					if (query.indexOf(keyword.toLowerCase()) != -1) {
    						hits++;
    					}
    				}
    			});

    			if (query.indexOf(website[1].split("?")[0]) != -1 || query.indexOf(website[1].split("/")[0]) != -1) {
    				hits = hits + 2;
    			}

    			if (query.indexOf(website[1].toLowerCase()) != -1) {
    				hits = hits + 5;
    			}

    			if (hits > 0) {
    				results.push([i, hits]);
    			}
    		});

    		results.sort((p, n) => n[1] - p[1]);
    		$$invalidate(0, visible = true);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SearchResultsContainer> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, visible = false);

    	$$self.$capture_state = () => ({
    		fly,
    		fade,
    		SearchResultBlock,
    		websites,
    		visible,
    		results,
    		startSearch
    	});

    	$$self.$inject_state = $$props => {
    		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
    		if ("results" in $$props) $$invalidate(1, results = $$props.results);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [visible, results, startSearch, click_handler];
    }

    class SearchResultsContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { startSearch: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SearchResultsContainer",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get startSearch() {
    		return this.$$.ctx[2];
    	}

    	set startSearch(value) {
    		throw new Error("<SearchResultsContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.37.0 */
    const file = "src\\App.svelte";

    // (29:4) {:else}
    function create_else_block(ctx) {
    	let header;
    	let current;
    	header = new Header({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(29:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (27:4) {#if username}
    function create_if_block(ctx) {
    	let header;
    	let current;

    	header = new Header({
    			props: { username: /*username*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(27:4) {#if username}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t0;
    	let searchbar;
    	let t1;
    	let searchresultscontainer;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*username*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let searchbar_props = {};
    	searchbar = new SearchBar({ props: searchbar_props, $$inline: true });
    	/*searchbar_binding*/ ctx[4](searchbar);
    	searchbar.$on("startSearch", /*activateSearch*/ ctx[3]);
    	let searchresultscontainer_props = {};

    	searchresultscontainer = new SearchResultsContainer({
    			props: searchresultscontainer_props,
    			$$inline: true
    		});

    	/*searchresultscontainer_binding*/ ctx[5](searchresultscontainer);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t0 = space();
    			create_component(searchbar.$$.fragment);
    			t1 = space();
    			create_component(searchresultscontainer.$$.fragment);
    			attr_dev(div, "class", "container");
    			add_location(div, file, 25, 0, 739);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append_dev(div, t0);
    			mount_component(searchbar, div, null);
    			append_dev(div, t1);
    			mount_component(searchresultscontainer, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if_block.p(ctx, dirty);
    			const searchbar_changes = {};
    			searchbar.$set(searchbar_changes);
    			const searchresultscontainer_changes = {};
    			searchresultscontainer.$set(searchresultscontainer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(searchbar.$$.fragment, local);
    			transition_in(searchresultscontainer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(searchbar.$$.fragment, local);
    			transition_out(searchresultscontainer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    			/*searchbar_binding*/ ctx[4](null);
    			destroy_component(searchbar);
    			/*searchresultscontainer_binding*/ ctx[5](null);
    			destroy_component(searchresultscontainer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let username = localStorage.getItem("username");
    	let searchResultsContainer;
    	let searchBar;

    	function activateSearch(e) {
    		searchResultsContainer.startSearch(e.detail.text);
    	}

    	onMount(() => {
    		let query = read_get()["search"];

    		if (query != undefined && query.length != 0) {
    			searchBar.readFromGet(htmlspecialchars(query));
    			searchResultsContainer.startSearch(htmlspecialchars(query));
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function searchbar_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			searchBar = $$value;
    			$$invalidate(1, searchBar);
    		});
    	}

    	function searchresultscontainer_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			searchResultsContainer = $$value;
    			$$invalidate(0, searchResultsContainer);
    		});
    	}

    	$$self.$capture_state = () => ({
    		Header,
    		SearchBar,
    		SearchResultsContainer,
    		onMount,
    		read_get,
    		htmlspecialchars,
    		username,
    		searchResultsContainer,
    		searchBar,
    		activateSearch
    	});

    	$$self.$inject_state = $$props => {
    		if ("username" in $$props) $$invalidate(2, username = $$props.username);
    		if ("searchResultsContainer" in $$props) $$invalidate(0, searchResultsContainer = $$props.searchResultsContainer);
    		if ("searchBar" in $$props) $$invalidate(1, searchBar = $$props.searchBar);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		searchResultsContainer,
    		searchBar,
    		username,
    		activateSearch,
    		searchbar_binding,
    		searchresultscontainer_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
