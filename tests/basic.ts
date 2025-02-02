import {
  createStore,
  GlobalVuexModule,
  NamespacedVuexModule,
  VuexActionHandler,
  VuexActionPayload,
  VuexActionResult,
  VuexGetter,
  VuexModulesWithPath,
  VuexMutationHandler,
  VuexMutationPayload,
  VuexStoreDefinition
} from "../types"
import { Validate } from "../types/helpers"

// example store definition
type FooState = { list: string[] }
type BarState = { result: string }
type BazState = { current: number }

enum FooMutations {
  Added = "added",
  Removed = "removed",
}

enum FooActions {
  Refresh = "refresh",
  Load = "load",
}

enum BarMutations {
  Fizz = "fizz",
  Buzz = "buzz",
}

enum BazMutations {
  Inc = "inc",
  Dec = "dec",
}

type FooMutationTree = {
  [FooMutations.Added]: VuexMutationHandler<FooState, string, MyStore>
  [FooMutations.Removed]: VuexMutationHandler<FooState, number, MyStore>
}

type FooActionsTree = {
  [FooActions.Refresh]: VuexActionHandler<FooModule, never, Promise<void>, MyStore>,
  [FooActions.Load]: VuexActionHandler<FooModule, string[], Promise<string[]>, MyStore>,
}

type FooGettersTree = {
  first: VuexGetter<FooModule, string>
  firstCapitalized: VuexGetter<FooModule, string>,
  rooted: VuexGetter<FooModule, string, MyStore>
}

type BarMutationTree = {
  [BarMutations.Fizz]: VuexMutationHandler<BarState, number>;
  [BarMutations.Buzz]: VuexMutationHandler<BarState>;
}

type BazMutationTree = {
  [BazMutations.Inc]: VuexMutationHandler<BazState, number>;
  [BazMutations.Dec]: VuexMutationHandler<BazState, number>;
}

type FooModule = NamespacedVuexModule<FooState, FooMutationTree, FooActionsTree, FooGettersTree, { sub: BazModule }>;
type BarModule = GlobalVuexModule<BarState, BarMutationTree>;
type BazModule = NamespacedVuexModule<BazState, BazMutationTree>;

type MyStore = Validate<VuexStoreDefinition, {
  state: {
    global: string;
  },
  modules: {
    foo: FooModule,
    bar: BarModule,
    anotherFoo: FooModule,
  },
  getters: {
    globalGetter: VuexGetter<MyStore, string>
  }
}>

// test
let store = createStore<MyStore>({} as any)

// should check and auto complete
store.commit("foo/added", "test");
store.commit({ type: "foo/added", payload: "test" });

// @ts-expect-error
store.commit("foo/added", 9);
// @ts-expect-error
store.commit("foo/added");

// dispatch works too!
store.dispatch("anotherFoo/load", ["test"]);
store.dispatch({ type: "anotherFoo/load", payload: ["test"] });

// @ts-expect-error
store.dispatch("anotherFoo/load", 0);
// @ts-expect-error
store.dispatch("foo/load");

// should check correctly
store.replaceState({
  global: "test",
  foo: {
    list: [],
    sub: {
      current: 0
    }
  },
  anotherFoo: {
    list: [],
    sub: {
      current: 0
    }
  },
  bar: {
    result: "fizzbuzz"
  }
})

// getters also work
store.getters['anotherFoo/first'];

// watch state is properly typed
store.watch(state => state.global, (value, oldValue) => value.toLowerCase() !== oldValue.toLowerCase())

// watch getters too!
store.watch((_, getters) => getters['foo/first'], (value, oldValue) => value.toLowerCase() !== oldValue.toLowerCase())

store.subscribe(mutation => {
  // properly detects payload type based on mutaiton kind
  if (mutation.type === "anotherFoo/sub/dec") {
    const number = mutation.payload; // typeof number = number
  } else if (mutation.type === "anotherFoo/added") {
    const str = mutation.payload; // typeof str = string
  }
})

store.subscribeAction((action, state) => {
  // properly detects payload type based on action kind
  if (action.type === "anotherFoo/load") {
    const arr = action.payload; // typeof arr = string[]
  }

  // state is also correctly represented
  const foo = state.foo.list;
})

// 
store.subscribeAction({
  after(action, state) { /* ... */ },
  before(action, state) { /* ... */ },
  error(action, state, error) { /* ... */ }
})

// getters with backreference
let fooGetters: FooGettersTree = {
  first: state => state.list[0], // state is correctly typed
  firstCapitalized: (_, getters, rootState, rootGetters) => getters.first.toUpperCase(), // getters too!
  rooted: (_, __, rootState, rootGetters) => rootState.global + rootGetters.globalGetter, // and global state!
}

let fooActions: FooActionsTree = {
  async load(context, payload): Promise<string[]> {
    // context is bound to this module
    // and payload is properly typed!
    context.commit(FooMutations.Added, payload[0]);

    // also works for actions
    context.dispatch(FooActions.Load, payload);
    context.dispatch(FooActions.Refresh);

    const list = context.state.list;

    // we can however access root state
    const bar = context.rootState.bar; // typeof bar = BarState;

    // ... and getters
    const first = context.rootGetters['anotherFoo/first'];

    return [];
  },
  async refresh(context) {
    // simple actions to not require return type!
  }
}

// utility types
type PayloadOfFooAddedMutation = VuexMutationPayload<MyStore, "foo/added">; // string

type PayloadOfFooLoadAction = VuexActionPayload<MyStore, "foo/load">; // string[]
type ResultOfFooLoadAction = VuexActionResult<MyStore, "foo/load">; // string[]
