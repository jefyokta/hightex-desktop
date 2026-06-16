var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode
      ? (__toESMCache_node ??= new WeakMap())
      : (__toESMCache_esm ??= new WeakMap());
    var cached = cache.get(mod);
    if (cached) return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to =
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true,
      });
  if (canCache) cache.set(mod, to);
  return to;
};
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap()).get(from),
    desc;
  if (entry) return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if ((from && typeof from === "object") || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __commonJS = (cb, mod) => () => (
  mod || cb((mod = { exports: {} }).exports, mod),
  mod.exports
);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name),
    });
};
var __esm = (fn, res) => () => (fn && (res = fn((fn = 0))), res);
var __require = /* @__PURE__ */ ((x) =>
  typeof require !== "undefined"
    ? require
    : typeof Proxy !== "undefined"
      ? new Proxy(x, {
          get: (a, b) => (typeof require !== "undefined" ? require : a)[b],
        })
      : x)(function (x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// node:path
var exports_path = {};
__export(exports_path, {
  sep: () => sep,
  resolve: () => resolve,
  relative: () => relative,
  posix: () => posix,
  parse: () => parse,
  normalize: () => normalize,
  join: () => join,
  isAbsolute: () => isAbsolute,
  format: () => format,
  extname: () => extname,
  dirname: () => dirname,
  delimiter: () => delimiter,
  default: () => path_default,
  basename: () => basename,
  _makeLong: () => _makeLong,
});
function assertPath(path) {
  if (typeof path !== "string")
    throw TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "",
    lastSegmentLength = 0,
    lastSlash = -1,
    dots = 0,
    code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (code === 47) break;
    else code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1);
      else if (lastSlash !== i - 1 && dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== 46 ||
          res.charCodeAt(res.length - 2) !== 46
        ) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) ((res = ""), (lastSegmentLength = 0));
              else
                ((res = res.slice(0, lastSlashIndex)),
                  (lastSegmentLength = res.length - 1 - res.lastIndexOf("/")));
              ((lastSlash = i), (dots = 0));
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            ((res = ""), (lastSegmentLength = 0), (lastSlash = i), (dots = 0));
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += "/..";
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += "/" + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      ((lastSlash = i), (dots = 0));
    } else if (code === 46 && dots !== -1) ++dots;
    else dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root,
    base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) return base;
  if (dir === pathObject.root) return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "",
    resolvedAbsolute = false,
    cwd;
  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0) path = arguments[i];
    else {
      if (cwd === undefined) cwd = process.cwd();
      path = cwd;
    }
    if ((assertPath(path), path.length === 0)) continue;
    ((resolvedPath = path + "/" + resolvedPath),
      (resolvedAbsolute = path.charCodeAt(0) === 47));
  }
  if (
    ((resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute)),
    resolvedAbsolute)
  )
    if (resolvedPath.length > 0) return "/" + resolvedPath;
    else return "/";
  else if (resolvedPath.length > 0) return resolvedPath;
  else return ".";
}
function normalize(path) {
  if ((assertPath(path), path.length === 0)) return ".";
  var isAbsolute = path.charCodeAt(0) === 47,
    trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (
    ((path = normalizeStringPosix(path, !isAbsolute)),
    path.length === 0 && !isAbsolute)
  )
    path = ".";
  if (path.length > 0 && trailingSeparator) path += "/";
  if (isAbsolute) return "/" + path;
  return path;
}
function isAbsolute(path) {
  return (assertPath(path), path.length > 0 && path.charCodeAt(0) === 47);
}
function join() {
  if (arguments.length === 0) return ".";
  var joined;
  for (var i = 0; i < arguments.length; ++i) {
    var arg = arguments[i];
    if ((assertPath(arg), arg.length > 0))
      if (joined === undefined) joined = arg;
      else joined += "/" + arg;
  }
  if (joined === undefined) return ".";
  return normalize(joined);
}
function relative(from, to) {
  if ((assertPath(from), assertPath(to), from === to)) return "";
  if (((from = resolve(from)), (to = resolve(to)), from === to)) return "";
  var fromStart = 1;
  for (; fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47) break;
  var fromEnd = from.length,
    fromLen = fromEnd - fromStart,
    toStart = 1;
  for (; toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47) break;
  var toEnd = to.length,
    toLen = toEnd - toStart,
    length = fromLen < toLen ? fromLen : toLen,
    lastCommonSep = -1,
    i = 0;
  for (; i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47) return to.slice(toStart + i + 1);
        else if (i === 0) return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47) lastCommonSep = i;
        else if (i === 0) lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i),
      toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode) break;
    else if (fromCode === 47) lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0) out += "..";
      else out += "/..";
  if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
  else {
    if (((toStart += lastCommonSep), to.charCodeAt(toStart) === 47)) ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if ((assertPath(path), path.length === 0)) return ".";
  var code = path.charCodeAt(0),
    hasRoot = code === 47,
    end = -1,
    matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i)
    if (((code = path.charCodeAt(i)), code === 47)) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else matchedSlash = false;
  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 1) return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0,
    end = -1,
    matchedSlash = true,
    i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path) return "";
    var extIdx = ext.length - 1,
      firstNonSlashEnd = -1;
    for (i = path.length - 1; i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          ((matchedSlash = false), (firstNonSlashEnd = i + 1));
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1) end = i;
          } else ((extIdx = -1), (end = firstNonSlashEnd));
      }
    }
    if (start === end) end = firstNonSlashEnd;
    else if (end === -1) end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1; i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) ((matchedSlash = false), (end = i + 1));
    if (end === -1) return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1,
    startPart = 0,
    end = -1,
    matchedSlash = true,
    preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) ((matchedSlash = false), (end = i + 1));
    if (code === 46) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) preDotState = -1;
  }
  if (
    startDot === -1 ||
    end === -1 ||
    preDotState === 0 ||
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  )
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw TypeError(
      'The "pathObject" argument must be of type Object. Received type ' +
        typeof pathObject,
    );
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0) return ret;
  var code = path.charCodeAt(0),
    isAbsolute2 = code === 47,
    start;
  if (isAbsolute2) ((ret.root = "/"), (start = 1));
  else start = 0;
  var startDot = -1,
    startPart = 0,
    end = -1,
    matchedSlash = true,
    i = path.length - 1,
    preDotState = 0;
  for (; i >= start; --i) {
    if (((code = path.charCodeAt(i)), code === 47)) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) ((matchedSlash = false), (end = i + 1));
    if (code === 46) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) preDotState = -1;
  }
  if (
    startDot === -1 ||
    end === -1 ||
    preDotState === 0 ||
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute2)
        ret.base = ret.name = path.slice(1, end);
      else ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute2)
      ((ret.name = path.slice(1, startDot)), (ret.base = path.slice(1, end)));
    else
      ((ret.name = path.slice(startPart, startDot)),
        (ret.base = path.slice(startPart, end)));
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute2) ret.dir = "/";
  return ret;
}
var sep = "/",
  delimiter = ":",
  posix,
  path_default;
var init_path = __esm(() => {
  posix = ((p) => ((p.posix = p), p))({
    resolve,
    normalize,
    isAbsolute,
    join,
    relative,
    _makeLong,
    dirname,
    basename,
    extname,
    format,
    parse,
    sep,
    delimiter,
    win32: null,
    posix: null,
  });
  path_default = posix;
});

// node_modules/better-sqlite3/lib/util.js
var require_util = __commonJS((exports) => {
  exports.getBooleanOption = (options, key) => {
    let value = false;
    if (key in options && typeof (value = options[key]) !== "boolean") {
      throw new TypeError(`Expected the "${key}" option to be a boolean`);
    }
    return value;
  };
  exports.cppdb = Symbol();
  exports.inspect = Symbol.for("nodejs.util.inspect.custom");
});

// node_modules/better-sqlite3/lib/sqlite-error.js
var require_sqlite_error = __commonJS((exports, module) => {
  var descriptor = {
    value: "SqliteError",
    writable: true,
    enumerable: false,
    configurable: true,
  };
  function SqliteError(message, code) {
    if (new.target !== SqliteError) {
      return new SqliteError(message, code);
    }
    if (typeof code !== "string") {
      throw new TypeError("Expected second argument to be a string");
    }
    Error.call(this, message);
    descriptor.value = "" + message;
    Object.defineProperty(this, "message", descriptor);
    Error.captureStackTrace(this, SqliteError);
    this.code = code;
  }
  Object.setPrototypeOf(SqliteError, Error);
  Object.setPrototypeOf(SqliteError.prototype, Error.prototype);
  Object.defineProperty(SqliteError.prototype, "name", descriptor);
  module.exports = SqliteError;
});

// node_modules/file-uri-to-path/index.js
var require_file_uri_to_path = __commonJS((exports, module) => {
  var sep2 = (init_path(), __toCommonJS(exports_path)).sep || "/";
  module.exports = fileUriToPath;
  function fileUriToPath(uri) {
    if (
      typeof uri != "string" ||
      uri.length <= 7 ||
      uri.substring(0, 7) != "file://"
    ) {
      throw new TypeError(
        "must pass in a file:// URI to convert to a file path",
      );
    }
    var rest = decodeURI(uri.substring(7));
    var firstSlash = rest.indexOf("/");
    var host = rest.substring(0, firstSlash);
    var path = rest.substring(firstSlash + 1);
    if (host == "localhost") host = "";
    if (host) {
      host = sep2 + sep2 + host;
    }
    path = path.replace(/^(.+)\|/, "$1:");
    if (sep2 == "\\") {
      path = path.replace(/\//g, "\\");
    }
    if (/^.+\:/.test(path)) {
    } else {
      path = sep2 + path;
    }
    return host + path;
  }
});

// node_modules/bindings/bindings.js
var require_bindings = __commonJS((exports, module) => {
  var __filename =
    "/Applications/jepi.okta/hightex-desktop/node_modules/bindings/bindings.js";
  var fs = () => ({});
  var path = (init_path(), __toCommonJS(exports_path));
  var fileURLToPath = require_file_uri_to_path();
  var join2 = path.join;
  var dirname2 = path.dirname;
  var exists =
    (fs.accessSync &&
      function (path2) {
        try {
          fs.accessSync(path2);
        } catch (e) {
          return false;
        }
        return true;
      }) ||
    fs.existsSync ||
    path.existsSync;
  var defaults = {
    arrow: process.env.NODE_BINDINGS_ARROW || " → ",
    compiled: process.env.NODE_BINDINGS_COMPILED_DIR || "compiled",
    platform: process.platform,
    arch: process.arch,
    nodePreGyp:
      "node-v" +
      process.versions.modules +
      "-" +
      process.platform +
      "-" +
      process.arch,
    version: process.versions.node,
    bindings: "bindings.node",
    try: [
      ["module_root", "build", "bindings"],
      ["module_root", "build", "Debug", "bindings"],
      ["module_root", "build", "Release", "bindings"],
      ["module_root", "out", "Debug", "bindings"],
      ["module_root", "Debug", "bindings"],
      ["module_root", "out", "Release", "bindings"],
      ["module_root", "Release", "bindings"],
      ["module_root", "build", "default", "bindings"],
      ["module_root", "compiled", "version", "platform", "arch", "bindings"],
      ["module_root", "addon-build", "release", "install-root", "bindings"],
      ["module_root", "addon-build", "debug", "install-root", "bindings"],
      ["module_root", "addon-build", "default", "install-root", "bindings"],
      ["module_root", "lib", "binding", "nodePreGyp", "bindings"],
    ],
  };
  function bindings(opts) {
    if (typeof opts == "string") {
      opts = { bindings: opts };
    } else if (!opts) {
      opts = {};
    }
    Object.keys(defaults).map(function (i2) {
      if (!(i2 in opts)) opts[i2] = defaults[i2];
    });
    if (!opts.module_root) {
      opts.module_root = exports.getRoot(exports.getFileName());
    }
    if (path.extname(opts.bindings) != ".node") {
      opts.bindings += ".node";
    }
    var requireFunc =
      typeof __webpack_require__ === "function"
        ? __non_webpack_require__
        : __require;
    var tries = [],
      i = 0,
      l = opts.try.length,
      n,
      b,
      err;
    for (; i < l; i++) {
      n = join2.apply(
        null,
        opts.try[i].map(function (p) {
          return opts[p] || p;
        }),
      );
      tries.push(n);
      try {
        b = opts.path ? requireFunc.resolve(n) : requireFunc(n);
        if (!opts.path) {
          b.path = n;
        }
        return b;
      } catch (e) {
        if (
          e.code !== "MODULE_NOT_FOUND" &&
          e.code !== "QUALIFIED_PATH_RESOLUTION_FAILED" &&
          !/not find/i.test(e.message)
        ) {
          throw e;
        }
      }
    }
    err = new Error(
      `Could not locate the bindings file. Tried:
` +
        tries.map(function (a) {
          return opts.arrow + a;
        }).join(`
`),
    );
    err.tries = tries;
    throw err;
  }
  module.exports = exports = bindings;
  exports.getFileName = function getFileName(calling_file) {
    var { prepareStackTrace: origPST, stackTraceLimit: origSTL } = Error,
      dummy = {},
      fileName;
    Error.stackTraceLimit = 10;
    Error.prepareStackTrace = function (e, st) {
      for (var i = 0, l = st.length; i < l; i++) {
        fileName = st[i].getFileName();
        if (fileName !== __filename) {
          if (calling_file) {
            if (fileName !== calling_file) {
              return;
            }
          } else {
            return;
          }
        }
      }
    };
    Error.captureStackTrace(dummy);
    dummy.stack;
    Error.prepareStackTrace = origPST;
    Error.stackTraceLimit = origSTL;
    var fileSchema = "file://";
    if (fileName.indexOf(fileSchema) === 0) {
      fileName = fileURLToPath(fileName);
    }
    return fileName;
  };
  exports.getRoot = function getRoot(file) {
    var dir = dirname2(file),
      prev;
    while (true) {
      if (dir === ".") {
        dir = process.cwd();
      }
      if (
        exists(join2(dir, "package.json")) ||
        exists(join2(dir, "node_modules"))
      ) {
        return dir;
      }
      if (prev === dir) {
        throw new Error(
          'Could not find module root given file: "' +
            file +
            '". Do you have a `package.json` file? ',
        );
      }
      prev = dir;
      dir = join2(dir, "..");
    }
  };
});

// node_modules/better-sqlite3/lib/methods/wrappers.js
var require_wrappers = __commonJS((exports) => {
  var { cppdb } = require_util();
  exports.prepare = function prepare(sql) {
    return this[cppdb].prepare(sql, this, false);
  };
  exports.exec = function exec(sql) {
    this[cppdb].exec(sql);
    return this;
  };
  exports.close = function close() {
    this[cppdb].close();
    return this;
  };
  exports.loadExtension = function loadExtension(...args) {
    this[cppdb].loadExtension(...args);
    return this;
  };
  exports.defaultSafeIntegers = function defaultSafeIntegers(...args) {
    this[cppdb].defaultSafeIntegers(...args);
    return this;
  };
  exports.unsafeMode = function unsafeMode(...args) {
    this[cppdb].unsafeMode(...args);
    return this;
  };
  exports.getters = {
    name: {
      get: function name() {
        return this[cppdb].name;
      },
      enumerable: true,
    },
    open: {
      get: function open() {
        return this[cppdb].open;
      },
      enumerable: true,
    },
    inTransaction: {
      get: function inTransaction() {
        return this[cppdb].inTransaction;
      },
      enumerable: true,
    },
    readonly: {
      get: function readonly() {
        return this[cppdb].readonly;
      },
      enumerable: true,
    },
    memory: {
      get: function memory() {
        return this[cppdb].memory;
      },
      enumerable: true,
    },
  };
});

// node_modules/better-sqlite3/lib/methods/transaction.js
var require_transaction = __commonJS((exports, module) => {
  var { cppdb } = require_util();
  var controllers = new WeakMap();
  module.exports = function transaction(fn) {
    if (typeof fn !== "function")
      throw new TypeError("Expected first argument to be a function");
    const db = this[cppdb];
    const controller = getController(db, this);
    const { apply } = Function.prototype;
    const properties = {
      default: { value: wrapTransaction(apply, fn, db, controller.default) },
      deferred: { value: wrapTransaction(apply, fn, db, controller.deferred) },
      immediate: {
        value: wrapTransaction(apply, fn, db, controller.immediate),
      },
      exclusive: {
        value: wrapTransaction(apply, fn, db, controller.exclusive),
      },
      database: { value: this, enumerable: true },
    };
    Object.defineProperties(properties.default.value, properties);
    Object.defineProperties(properties.deferred.value, properties);
    Object.defineProperties(properties.immediate.value, properties);
    Object.defineProperties(properties.exclusive.value, properties);
    return properties.default.value;
  };
  var getController = (db, self) => {
    let controller = controllers.get(db);
    if (!controller) {
      const shared = {
        commit: db.prepare("COMMIT", self, false),
        rollback: db.prepare("ROLLBACK", self, false),
        savepoint: db.prepare("SAVEPOINT `\t_bs3.\t`", self, false),
        release: db.prepare("RELEASE `\t_bs3.\t`", self, false),
        rollbackTo: db.prepare("ROLLBACK TO `\t_bs3.\t`", self, false),
      };
      controllers.set(
        db,
        (controller = {
          default: Object.assign(
            { begin: db.prepare("BEGIN", self, false) },
            shared,
          ),
          deferred: Object.assign(
            { begin: db.prepare("BEGIN DEFERRED", self, false) },
            shared,
          ),
          immediate: Object.assign(
            { begin: db.prepare("BEGIN IMMEDIATE", self, false) },
            shared,
          ),
          exclusive: Object.assign(
            { begin: db.prepare("BEGIN EXCLUSIVE", self, false) },
            shared,
          ),
        }),
      );
    }
    return controller;
  };
  var wrapTransaction = (
    apply,
    fn,
    db,
    { begin, commit, rollback, savepoint, release, rollbackTo },
  ) =>
    function sqliteTransaction() {
      let before, after, undo;
      if (db.inTransaction) {
        before = savepoint;
        after = release;
        undo = rollbackTo;
      } else {
        before = begin;
        after = commit;
        undo = rollback;
      }
      before.run();
      try {
        const result = apply.call(fn, this, arguments);
        if (result && typeof result.then === "function") {
          throw new TypeError("Transaction function cannot return a promise");
        }
        after.run();
        return result;
      } catch (ex) {
        if (db.inTransaction) {
          undo.run();
          if (undo !== rollback) after.run();
        }
        throw ex;
      }
    };
});

// node_modules/better-sqlite3/lib/methods/pragma.js
var require_pragma = __commonJS((exports, module) => {
  var { getBooleanOption, cppdb } = require_util();
  module.exports = function pragma(source, options) {
    if (options == null) options = {};
    if (typeof source !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object")
      throw new TypeError("Expected second argument to be an options object");
    const simple = getBooleanOption(options, "simple");
    const stmt = this[cppdb].prepare(`PRAGMA ${source}`, this, true);
    return simple ? stmt.pluck().get() : stmt.all();
  };
});

// node:util
var exports_util = {};
__export(exports_util, {
  types: () => types,
  promisify: () => promisify,
  log: () => log,
  isUndefined: () => isUndefined,
  isSymbol: () => isSymbol,
  isString: () => isString,
  isRegExp: () => isRegExp,
  isPrimitive: () => isPrimitive,
  isObject: () => isObject,
  isNumber: () => isNumber,
  isNullOrUndefined: () => isNullOrUndefined,
  isNull: () => isNull,
  isFunction: () => isFunction,
  isError: () => isError,
  isDate: () => isDate,
  isBuffer: () => isBuffer,
  isBoolean: () => isBoolean,
  isArray: () => isArray,
  inspect: () => inspect,
  inherits: () => inherits,
  format: () => format2,
  deprecate: () => deprecate,
  default: () => util_default,
  debuglog: () => debuglog,
  callbackifyOnRejected: () => callbackifyOnRejected,
  callbackify: () => callbackify,
  _extend: () => _extend,
  TextEncoder: () => TextEncoder,
  TextDecoder: () => TextDecoder,
});
function format2(f, ...args) {
  if (!isString(f)) {
    var objects = [f];
    for (var i = 0; i < args.length; i++) objects.push(inspect(args[i]));
    return objects.join(" ");
  }
  var i = 0,
    len = args.length,
    str = String(f).replace(formatRegExp, function (x2) {
      if (x2 === "%%") return "%";
      if (i >= len) return x2;
      switch (x2) {
        case "%s":
          return String(args[i++]);
        case "%d":
          return Number(args[i++]);
        case "%j":
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return "[Circular]";
          }
        default:
          return x2;
      }
    });
  for (var x = args[i]; i < len; x = args[++i])
    if (isNull(x) || !isObject(x)) str += " " + x;
    else str += " " + inspect(x);
  return str;
}
function deprecate(fn, msg) {
  if (typeof process > "u" || process?.noDeprecation === true) return fn;
  var warned = false;
  function deprecated(...args) {
    if (!warned) {
      if (process.throwDeprecation) throw Error(msg);
      else if (process.traceDeprecation) console.trace(msg);
      else console.error(msg);
      warned = true;
    }
    return fn.apply(this, ...args);
  }
  return deprecated;
}
function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];
  if (style)
    return (
      "\x1B[" +
      inspect.colors[style][0] +
      "m" +
      str +
      "\x1B[" +
      inspect.colors[style][1] +
      "m"
    );
  else return str;
}
function stylizeNoColor(str, styleType) {
  return str;
}
function arrayToHash(array) {
  var hash = {};
  return (
    array.forEach(function (val, idx) {
      hash[val] = true;
    }),
    hash
  );
}
function formatValue(ctx, value, recurseTimes) {
  if (
    ctx.customInspect &&
    value &&
    isFunction(value.inspect) &&
    value.inspect !== inspect &&
    !(value.constructor && value.constructor.prototype === value)
  ) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) ret = formatValue(ctx, ret, recurseTimes);
    return ret;
  }
  var primitive = formatPrimitive(ctx, value);
  if (primitive) return primitive;
  var keys = Object.keys(value),
    visibleKeys = arrayToHash(keys);
  if (ctx.showHidden) keys = Object.getOwnPropertyNames(value);
  if (
    isError(value) &&
    (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)
  )
    return formatError(value);
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ": " + value.name : "";
      return ctx.stylize("[Function" + name + "]", "special");
    }
    if (isRegExp(value))
      return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
    if (isDate(value))
      return ctx.stylize(Date.prototype.toString.call(value), "date");
    if (isError(value)) return formatError(value);
  }
  var base = "",
    array = false,
    braces = ["{", "}"];
  if (isArray(value)) ((array = true), (braces = ["[", "]"]));
  if (isFunction(value)) {
    var n = value.name ? ": " + value.name : "";
    base = " [Function" + n + "]";
  }
  if (isRegExp(value)) base = " " + RegExp.prototype.toString.call(value);
  if (isDate(value)) base = " " + Date.prototype.toUTCString.call(value);
  if (isError(value)) base = " " + formatError(value);
  if (keys.length === 0 && (!array || value.length == 0))
    return braces[0] + base + braces[1];
  if (recurseTimes < 0)
    if (isRegExp(value))
      return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
    else return ctx.stylize("[Object]", "special");
  ctx.seen.push(value);
  var output;
  if (array) output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  else
    output = keys.map(function (key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  return (ctx.seen.pop(), reduceToSingleString(output, base, braces));
}
function formatPrimitive(ctx, value) {
  if (isUndefined(value)) return ctx.stylize("undefined", "undefined");
  if (isString(value)) {
    var simple =
      "'" +
      JSON.stringify(value)
        .replace(/^"|"$/g, "")
        .replace(/'/g, "\\'")
        .replace(/\\"/g, '"') +
      "'";
    return ctx.stylize(simple, "string");
  }
  if (isNumber(value)) return ctx.stylize("" + value, "number");
  if (isBoolean(value)) return ctx.stylize("" + value, "boolean");
  if (isNull(value)) return ctx.stylize("null", "null");
}
function formatError(value) {
  return "[" + Error.prototype.toString.call(value) + "]";
}
function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i)
    if (hasOwnProperty(value, String(i)))
      output.push(
        formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true),
      );
    else output.push("");
  return (
    keys.forEach(function (key) {
      if (!key.match(/^\d+$/))
        output.push(
          formatProperty(ctx, value, recurseTimes, visibleKeys, key, true),
        );
    }),
    output
  );
}
function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  if (
    ((desc = Object.getOwnPropertyDescriptor(value, key) || {
      value: value[key],
    }),
    desc.get)
  )
    if (desc.set) str = ctx.stylize("[Getter/Setter]", "special");
    else str = ctx.stylize("[Getter]", "special");
  else if (desc.set) str = ctx.stylize("[Setter]", "special");
  if (!hasOwnProperty(visibleKeys, key)) name = "[" + key + "]";
  if (!str)
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) str = formatValue(ctx, desc.value, null);
      else str = formatValue(ctx, desc.value, recurseTimes - 1);
      if (
        str.indexOf(`
`) > -1
      )
        if (array)
          str = str
            .split(
              `
`,
            )
            .map(function (line) {
              return "  " + line;
            })
            .join(
              `
`,
            )
            .slice(2);
        else
          str =
            `
` +
            str
              .split(
                `
`,
              )
              .map(function (line) {
                return "   " + line;
              }).join(`
`);
    } else str = ctx.stylize("[Circular]", "special");
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) return str;
    if (
      ((name = JSON.stringify("" + key)),
      name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/))
    )
      ((name = name.slice(1, -1)), (name = ctx.stylize(name, "name")));
    else
      ((name = name
        .replace(/'/g, "\\'")
        .replace(/\\"/g, '"')
        .replace(/(^"|"$)/g, "'")),
        (name = ctx.stylize(name, "string")));
  }
  return name + ": " + str;
}
function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0,
    length = output.reduce(function (prev, cur) {
      if (
        (numLinesEst++,
        cur.indexOf(`
`) >= 0)
      )
        numLinesEst++;
      return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1;
    }, 0);
  if (length > 60)
    return (
      braces[0] +
      (base === ""
        ? ""
        : base +
          `
 `) +
      " " +
      output.join(`,
  `) +
      " " +
      braces[1]
    );
  return braces[0] + base + " " + output.join(", ") + " " + braces[1];
}
function isArray(ar) {
  return Array.isArray(ar);
}
function isBoolean(arg) {
  return typeof arg === "boolean";
}
function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return arg == null;
}
function isNumber(arg) {
  return typeof arg === "number";
}
function isString(arg) {
  return typeof arg === "string";
}
function isSymbol(arg) {
  return typeof arg === "symbol";
}
function isUndefined(arg) {
  return arg === undefined;
}
function isRegExp(re) {
  return isObject(re) && objectToString(re) === "[object RegExp]";
}
function isObject(arg) {
  return typeof arg === "object" && arg !== null;
}
function isDate(d) {
  return isObject(d) && objectToString(d) === "[object Date]";
}
function isError(e) {
  return (
    isObject(e) &&
    (objectToString(e) === "[object Error]" || e instanceof Error)
  );
}
function isFunction(arg) {
  return typeof arg === "function";
}
function isPrimitive(arg) {
  return (
    arg === null ||
    typeof arg === "boolean" ||
    typeof arg === "number" ||
    typeof arg === "string" ||
    typeof arg === "symbol" ||
    typeof arg > "u"
  );
}
function isBuffer(arg) {
  return arg instanceof Buffer;
}
function objectToString(o) {
  return Object.prototype.toString.call(o);
}
function pad(n) {
  return n < 10 ? "0" + n.toString(10) : n.toString(10);
}
function timestamp() {
  var d = new Date(),
    time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(
      ":",
    );
  return [d.getDate(), months[d.getMonth()], time].join(" ");
}
function log(...args) {
  console.log("%s - %s", timestamp(), format2.apply(null, args));
}
function inherits(ctor, superCtor) {
  if (superCtor)
    ((ctor.super_ = superCtor),
      (ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true,
        },
      })));
}
function _extend(origin, add) {
  if (!add || !isObject(add)) return origin;
  var keys = Object.keys(add),
    i = keys.length;
  while (i--) origin[keys[i]] = add[keys[i]];
  return origin;
}
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
function callbackifyOnRejected(reason, cb) {
  if (!reason) {
    var newReason = Error("Promise was rejected with a falsy value");
    ((newReason.reason = reason), (reason = newReason));
  }
  return cb(reason);
}
function callbackify(original) {
  if (typeof original !== "function")
    throw TypeError('The "original" argument must be of type Function');
  function callbackified(...args) {
    var maybeCb = args.pop();
    if (typeof maybeCb !== "function")
      throw TypeError("The last argument must be of type Function");
    var self = this,
      cb = function (...args2) {
        return maybeCb.apply(self, ...args2);
      };
    original.apply(this, args).then(
      function (ret) {
        process.nextTick(cb.bind(null, null, ret));
      },
      function (rej) {
        process.nextTick(callbackifyOnRejected.bind(null, rej, cb));
      },
    );
  }
  return (
    Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original)),
    Object.defineProperties(
      callbackified,
      Object.getOwnPropertyDescriptors(original),
    ),
    callbackified
  );
}
var formatRegExp,
  debuglog,
  inspect,
  types = () => {},
  months,
  promisify,
  TextEncoder,
  TextDecoder,
  util_default;
var init_util = __esm(() => {
  formatRegExp = /%[sdj%]/g;
  debuglog = ((debugs = {}, debugEnvRegex = {}, debugEnv) => (
    (debugEnv = typeof process < "u" && false) &&
      (debugEnv = debugEnv
        .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/,/g, "$|^")
        .toUpperCase()),
    (debugEnvRegex = new RegExp("^" + debugEnv + "$", "i")),
    (set) => {
      if (((set = set.toUpperCase()), !debugs[set]))
        if (debugEnvRegex.test(set))
          debugs[set] = function (...args) {
            console.error("%s: %s", set, pid, format2.apply(null, ...args));
          };
        else debugs[set] = function () {};
      return debugs[set];
    }
  ))();
  inspect = ((i) => (
    (i.colors = {
      bold: [1, 22],
      italic: [3, 23],
      underline: [4, 24],
      inverse: [7, 27],
      white: [37, 39],
      grey: [90, 39],
      black: [30, 39],
      blue: [34, 39],
      cyan: [36, 39],
      green: [32, 39],
      magenta: [35, 39],
      red: [31, 39],
      yellow: [33, 39],
    }),
    (i.styles = {
      special: "cyan",
      number: "yellow",
      boolean: "yellow",
      undefined: "grey",
      null: "bold",
      string: "green",
      date: "magenta",
      regexp: "red",
    }),
    (i.custom = Symbol.for("nodejs.util.inspect.custom")),
    i
  ))(function (obj, opts, ...rest) {
    var ctx = { seen: [], stylize: stylizeNoColor };
    if (rest.length >= 1) ctx.depth = rest[0];
    if (rest.length >= 2) ctx.colors = rest[1];
    if (isBoolean(opts)) ctx.showHidden = opts;
    else if (opts) _extend(ctx, opts);
    if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
    if (isUndefined(ctx.depth)) ctx.depth = 2;
    if (isUndefined(ctx.colors)) ctx.colors = false;
    if (ctx.colors) ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
  });
  months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  promisify = ((x) => (
    (x.custom = Symbol.for("nodejs.util.promisify.custom")),
    x
  ))(function (original) {
    if (typeof original !== "function") {
      console.log(original);
      throw TypeError('The "original" argument must be of type Function');
    }
    if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
      var fn = original[kCustomPromisifiedSymbol];
      if (typeof fn !== "function")
        throw TypeError(
          'The "nodejs.util.promisify.custom" argument must be of type Function',
        );
      return (
        Object.defineProperty(fn, kCustomPromisifiedSymbol, {
          value: fn,
          enumerable: false,
          writable: false,
          configurable: true,
        }),
        fn
      );
    }
    function fn(...args) {
      var promiseResolve,
        promiseReject,
        promise = new Promise(function (resolve2, reject) {
          ((promiseResolve = resolve2), (promiseReject = reject));
        });
      args.push(function (err, value) {
        if (err) promiseReject(err);
        else promiseResolve(value);
      });
      try {
        original.apply(this, args);
      } catch (err) {
        promiseReject(err);
      }
      return promise;
    }
    if (
      (Object.setPrototypeOf(fn, Object.getPrototypeOf(original)),
      kCustomPromisifiedSymbol)
    )
      Object.defineProperty(fn, kCustomPromisifiedSymbol, {
        value: fn,
        enumerable: false,
        writable: false,
        configurable: true,
      });
    return Object.defineProperties(
      fn,
      Object.getOwnPropertyDescriptors(original),
    );
  });
  ({ TextEncoder, TextDecoder } = globalThis);
  util_default = {
    TextEncoder,
    TextDecoder,
    promisify,
    log,
    inherits,
    _extend,
    callbackifyOnRejected,
    callbackify,
  };
});

// node_modules/better-sqlite3/lib/methods/backup.js
var require_backup = __commonJS((exports, module) => {
  var fs = () => ({});
  var path = (init_path(), __toCommonJS(exports_path));
  var { promisify: promisify2 } = (init_util(), __toCommonJS(exports_util));
  var { cppdb } = require_util();
  var fsAccess = promisify2(fs.access);
  module.exports = async function backup(filename, options) {
    if (options == null) options = {};
    if (typeof filename !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object")
      throw new TypeError("Expected second argument to be an options object");
    filename = filename.trim();
    const attachedName = "attached" in options ? options.attached : "main";
    const handler = "progress" in options ? options.progress : null;
    if (!filename)
      throw new TypeError("Backup filename cannot be an empty string");
    if (filename === ":memory:")
      throw new TypeError('Invalid backup filename ":memory:"');
    if (typeof attachedName !== "string")
      throw new TypeError('Expected the "attached" option to be a string');
    if (!attachedName)
      throw new TypeError('The "attached" option cannot be an empty string');
    if (handler != null && typeof handler !== "function")
      throw new TypeError('Expected the "progress" option to be a function');
    await fsAccess(path.dirname(filename)).catch(() => {
      throw new TypeError(
        "Cannot save backup because the directory does not exist",
      );
    });
    const isNewFile = await fsAccess(filename).then(
      () => false,
      () => true,
    );
    return runBackup(
      this[cppdb].backup(this, attachedName, filename, isNewFile),
      handler || null,
    );
  };
  var runBackup = (backup, handler) => {
    let rate = 0;
    let useDefault = true;
    return new Promise((resolve2, reject) => {
      setImmediate(function step() {
        try {
          const progress = backup.transfer(rate);
          if (!progress.remainingPages) {
            backup.close();
            resolve2(progress);
            return;
          }
          if (useDefault) {
            useDefault = false;
            rate = 100;
          }
          if (handler) {
            const ret = handler(progress);
            if (ret !== undefined) {
              if (typeof ret === "number" && ret === ret)
                rate = Math.max(0, Math.min(2147483647, Math.round(ret)));
              else
                throw new TypeError(
                  "Expected progress callback to return a number or undefined",
                );
            }
          }
          setImmediate(step);
        } catch (err) {
          backup.close();
          reject(err);
        }
      });
    });
  };
});

// node_modules/better-sqlite3/lib/methods/serialize.js
var require_serialize = __commonJS((exports, module) => {
  var { cppdb } = require_util();
  module.exports = function serialize(options) {
    if (options == null) options = {};
    if (typeof options !== "object")
      throw new TypeError("Expected first argument to be an options object");
    const attachedName = "attached" in options ? options.attached : "main";
    if (typeof attachedName !== "string")
      throw new TypeError('Expected the "attached" option to be a string');
    if (!attachedName)
      throw new TypeError('The "attached" option cannot be an empty string');
    return this[cppdb].serialize(attachedName);
  };
});

// node_modules/better-sqlite3/lib/methods/function.js
var require_function = __commonJS((exports, module) => {
  var { getBooleanOption, cppdb } = require_util();
  module.exports = function defineFunction(name, options, fn) {
    if (options == null) options = {};
    if (typeof options === "function") {
      fn = options;
      options = {};
    }
    if (typeof name !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (typeof fn !== "function")
      throw new TypeError("Expected last argument to be a function");
    if (typeof options !== "object")
      throw new TypeError("Expected second argument to be an options object");
    if (!name)
      throw new TypeError(
        "User-defined function name cannot be an empty string",
      );
    const safeIntegers =
      "safeIntegers" in options
        ? +getBooleanOption(options, "safeIntegers")
        : 2;
    const deterministic = getBooleanOption(options, "deterministic");
    const directOnly = getBooleanOption(options, "directOnly");
    const varargs = getBooleanOption(options, "varargs");
    let argCount = -1;
    if (!varargs) {
      argCount = fn.length;
      if (!Number.isInteger(argCount) || argCount < 0)
        throw new TypeError(
          "Expected function.length to be a positive integer",
        );
      if (argCount > 100)
        throw new RangeError(
          "User-defined functions cannot have more than 100 arguments",
        );
    }
    this[cppdb].function(
      fn,
      name,
      argCount,
      safeIntegers,
      deterministic,
      directOnly,
    );
    return this;
  };
});

// node_modules/better-sqlite3/lib/methods/aggregate.js
var require_aggregate = __commonJS((exports, module) => {
  var { getBooleanOption, cppdb } = require_util();
  module.exports = function defineAggregate(name, options) {
    if (typeof name !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object" || options === null)
      throw new TypeError("Expected second argument to be an options object");
    if (!name)
      throw new TypeError(
        "User-defined function name cannot be an empty string",
      );
    const start = "start" in options ? options.start : null;
    const step = getFunctionOption(options, "step", true);
    const inverse = getFunctionOption(options, "inverse", false);
    const result = getFunctionOption(options, "result", false);
    const safeIntegers =
      "safeIntegers" in options
        ? +getBooleanOption(options, "safeIntegers")
        : 2;
    const deterministic = getBooleanOption(options, "deterministic");
    const directOnly = getBooleanOption(options, "directOnly");
    const varargs = getBooleanOption(options, "varargs");
    let argCount = -1;
    if (!varargs) {
      argCount = Math.max(getLength(step), inverse ? getLength(inverse) : 0);
      if (argCount > 0) argCount -= 1;
      if (argCount > 100)
        throw new RangeError(
          "User-defined functions cannot have more than 100 arguments",
        );
    }
    this[cppdb].aggregate(
      start,
      step,
      inverse,
      result,
      name,
      argCount,
      safeIntegers,
      deterministic,
      directOnly,
    );
    return this;
  };
  var getFunctionOption = (options, key, required) => {
    const value = key in options ? options[key] : null;
    if (typeof value === "function") return value;
    if (value != null)
      throw new TypeError(`Expected the "${key}" option to be a function`);
    if (required) throw new TypeError(`Missing required option "${key}"`);
    return null;
  };
  var getLength = ({ length }) => {
    if (Number.isInteger(length) && length >= 0) return length;
    throw new TypeError("Expected function.length to be a positive integer");
  };
});

// node_modules/better-sqlite3/lib/methods/table.js
var require_table = __commonJS((exports, module) => {
  var { cppdb } = require_util();
  module.exports = function defineTable(name, factory) {
    if (typeof name !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (!name)
      throw new TypeError(
        "Virtual table module name cannot be an empty string",
      );
    let eponymous = false;
    if (typeof factory === "object" && factory !== null) {
      eponymous = true;
      factory = defer(parseTableDefinition(factory, "used", name));
    } else {
      if (typeof factory !== "function")
        throw new TypeError(
          "Expected second argument to be a function or a table definition object",
        );
      factory = wrapFactory(factory);
    }
    this[cppdb].table(factory, name, eponymous);
    return this;
  };
  function wrapFactory(factory) {
    return function virtualTableFactory(
      moduleName,
      databaseName,
      tableName,
      ...args
    ) {
      const thisObject = {
        module: moduleName,
        database: databaseName,
        table: tableName,
      };
      const def = apply.call(factory, thisObject, args);
      if (typeof def !== "object" || def === null) {
        throw new TypeError(
          `Virtual table module "${moduleName}" did not return a table definition object`,
        );
      }
      return parseTableDefinition(def, "returned", moduleName);
    };
  }
  function parseTableDefinition(def, verb, moduleName) {
    if (!hasOwnProperty2.call(def, "rows")) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition without a "rows" property`,
      );
    }
    if (!hasOwnProperty2.call(def, "columns")) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition without a "columns" property`,
      );
    }
    const rows = def.rows;
    if (
      typeof rows !== "function" ||
      Object.getPrototypeOf(rows) !== GeneratorFunctionPrototype
    ) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with an invalid "rows" property (should be a generator function)`,
      );
    }
    let columns = def.columns;
    if (
      !Array.isArray(columns) ||
      !(columns = [...columns]).every((x) => typeof x === "string")
    ) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with an invalid "columns" property (should be an array of strings)`,
      );
    }
    if (columns.length !== new Set(columns).size) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with duplicate column names`,
      );
    }
    if (!columns.length) {
      throw new RangeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with zero columns`,
      );
    }
    let parameters;
    if (hasOwnProperty2.call(def, "parameters")) {
      parameters = def.parameters;
      if (
        !Array.isArray(parameters) ||
        !(parameters = [...parameters]).every((x) => typeof x === "string")
      ) {
        throw new TypeError(
          `Virtual table module "${moduleName}" ${verb} a table definition with an invalid "parameters" property (should be an array of strings)`,
        );
      }
    } else {
      parameters = inferParameters(rows);
    }
    if (parameters.length !== new Set(parameters).size) {
      throw new TypeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with duplicate parameter names`,
      );
    }
    if (parameters.length > 32) {
      throw new RangeError(
        `Virtual table module "${moduleName}" ${verb} a table definition with more than the maximum number of 32 parameters`,
      );
    }
    for (const parameter of parameters) {
      if (columns.includes(parameter)) {
        throw new TypeError(
          `Virtual table module "${moduleName}" ${verb} a table definition with column "${parameter}" which was ambiguously defined as both a column and parameter`,
        );
      }
    }
    let safeIntegers = 2;
    if (hasOwnProperty2.call(def, "safeIntegers")) {
      const bool = def.safeIntegers;
      if (typeof bool !== "boolean") {
        throw new TypeError(
          `Virtual table module "${moduleName}" ${verb} a table definition with an invalid "safeIntegers" property (should be a boolean)`,
        );
      }
      safeIntegers = +bool;
    }
    let directOnly = false;
    if (hasOwnProperty2.call(def, "directOnly")) {
      directOnly = def.directOnly;
      if (typeof directOnly !== "boolean") {
        throw new TypeError(
          `Virtual table module "${moduleName}" ${verb} a table definition with an invalid "directOnly" property (should be a boolean)`,
        );
      }
    }
    const columnDefinitions = [
      ...parameters.map(identifier).map((str) => `${str} HIDDEN`),
      ...columns.map(identifier),
    ];
    return [
      `CREATE TABLE x(${columnDefinitions.join(", ")});`,
      wrapGenerator(
        rows,
        new Map(columns.map((x, i) => [x, parameters.length + i])),
        moduleName,
      ),
      parameters,
      safeIntegers,
      directOnly,
    ];
  }
  function wrapGenerator(generator, columnMap, moduleName) {
    return function* virtualTable(...args) {
      const output = args.map((x) => (Buffer.isBuffer(x) ? Buffer.from(x) : x));
      for (let i = 0; i < columnMap.size; ++i) {
        output.push(null);
      }
      for (const row of generator(...args)) {
        if (Array.isArray(row)) {
          extractRowArray(row, output, columnMap.size, moduleName);
          yield output;
        } else if (typeof row === "object" && row !== null) {
          extractRowObject(row, output, columnMap, moduleName);
          yield output;
        } else {
          throw new TypeError(
            `Virtual table module "${moduleName}" yielded something that isn't a valid row object`,
          );
        }
      }
    };
  }
  function extractRowArray(row, output, columnCount, moduleName) {
    if (row.length !== columnCount) {
      throw new TypeError(
        `Virtual table module "${moduleName}" yielded a row with an incorrect number of columns`,
      );
    }
    const offset = output.length - columnCount;
    for (let i = 0; i < columnCount; ++i) {
      output[i + offset] = row[i];
    }
  }
  function extractRowObject(row, output, columnMap, moduleName) {
    let count = 0;
    for (const key of Object.keys(row)) {
      const index = columnMap.get(key);
      if (index === undefined) {
        throw new TypeError(
          `Virtual table module "${moduleName}" yielded a row with an undeclared column "${key}"`,
        );
      }
      output[index] = row[key];
      count += 1;
    }
    if (count !== columnMap.size) {
      throw new TypeError(
        `Virtual table module "${moduleName}" yielded a row with missing columns`,
      );
    }
  }
  function inferParameters({ length }) {
    if (!Number.isInteger(length) || length < 0) {
      throw new TypeError("Expected function.length to be a positive integer");
    }
    const params = [];
    for (let i = 0; i < length; ++i) {
      params.push(`$${i + 1}`);
    }
    return params;
  }
  var { hasOwnProperty: hasOwnProperty2 } = Object.prototype;
  var { apply } = Function.prototype;
  var GeneratorFunctionPrototype = Object.getPrototypeOf(function* () {});
  var identifier = (str) => `"${str.replace(/"/g, '""')}"`;
  var defer = (x) => () => x;
});

// node_modules/better-sqlite3/lib/methods/inspect.js
var require_inspect = __commonJS((exports, module) => {
  var DatabaseInspection = function Database() {};
  module.exports = function inspect2(depth, opts) {
    return Object.assign(new DatabaseInspection(), this);
  };
});

// node_modules/better-sqlite3/lib/database.js
var require_database = __commonJS((exports, module) => {
  var fs = () => ({});
  var path = (init_path(), __toCommonJS(exports_path));
  var util = require_util();
  var SqliteError = require_sqlite_error();
  var DEFAULT_ADDON;
  function Database(filenameGiven, options) {
    if (new.target == null) {
      return new Database(filenameGiven, options);
    }
    let buffer;
    if (Buffer.isBuffer(filenameGiven)) {
      buffer = filenameGiven;
      filenameGiven = ":memory:";
    }
    if (filenameGiven == null) filenameGiven = "";
    if (options == null) options = {};
    if (typeof filenameGiven !== "string")
      throw new TypeError("Expected first argument to be a string");
    if (typeof options !== "object")
      throw new TypeError("Expected second argument to be an options object");
    if ("readOnly" in options)
      throw new TypeError('Misspelled option "readOnly" should be "readonly"');
    if ("memory" in options)
      throw new TypeError(
        'Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)',
      );
    const filename = filenameGiven.trim();
    const anonymous = filename === "" || filename === ":memory:";
    const readonly = util.getBooleanOption(options, "readonly");
    const fileMustExist = util.getBooleanOption(options, "fileMustExist");
    const timeout = "timeout" in options ? options.timeout : 5000;
    const verbose = "verbose" in options ? options.verbose : null;
    const nativeBinding =
      "nativeBinding" in options ? options.nativeBinding : null;
    if (readonly && anonymous && !buffer)
      throw new TypeError("In-memory/temporary databases cannot be readonly");
    if (!Number.isInteger(timeout) || timeout < 0)
      throw new TypeError(
        'Expected the "timeout" option to be a positive integer',
      );
    if (timeout > 2147483647)
      throw new RangeError(
        'Option "timeout" cannot be greater than 2147483647',
      );
    if (verbose != null && typeof verbose !== "function")
      throw new TypeError('Expected the "verbose" option to be a function');
    if (
      nativeBinding != null &&
      typeof nativeBinding !== "string" &&
      typeof nativeBinding !== "object"
    )
      throw new TypeError(
        'Expected the "nativeBinding" option to be a string or addon object',
      );
    let addon;
    if (nativeBinding == null) {
      addon =
        DEFAULT_ADDON ||
        (DEFAULT_ADDON = require_bindings()("better_sqlite3.node"));
    } else if (typeof nativeBinding === "string") {
      const requireFunc =
        typeof __non_webpack_require__ === "function"
          ? __non_webpack_require__
          : __require;
      addon = requireFunc(
        path.resolve(nativeBinding).replace(/(\.node)?$/, ".node"),
      );
    } else {
      addon = nativeBinding;
    }
    if (!addon.isInitialized) {
      addon.setErrorConstructor(SqliteError);
      addon.isInitialized = true;
    }
    if (
      !anonymous &&
      !filename.startsWith("file:") &&
      !fs.existsSync(path.dirname(filename))
    ) {
      throw new TypeError(
        "Cannot open database because the directory does not exist",
      );
    }
    Object.defineProperties(this, {
      [util.cppdb]: {
        value: new addon.Database(
          filename,
          filenameGiven,
          anonymous,
          readonly,
          fileMustExist,
          timeout,
          verbose || null,
          buffer || null,
        ),
      },
      ...wrappers.getters,
    });
  }
  var wrappers = require_wrappers();
  Database.prototype.prepare = wrappers.prepare;
  Database.prototype.transaction = require_transaction();
  Database.prototype.pragma = require_pragma();
  Database.prototype.backup = require_backup();
  Database.prototype.serialize = require_serialize();
  Database.prototype.function = require_function();
  Database.prototype.aggregate = require_aggregate();
  Database.prototype.table = require_table();
  Database.prototype.loadExtension = wrappers.loadExtension;
  Database.prototype.exec = wrappers.exec;
  Database.prototype.close = wrappers.close;
  Database.prototype.defaultSafeIntegers = wrappers.defaultSafeIntegers;
  Database.prototype.unsafeMode = wrappers.unsafeMode;
  Database.prototype[util.inspect] = require_inspect();
  module.exports = Database;
});

// node_modules/better-sqlite3/lib/index.js
var require_lib = __commonJS((exports, module) => {
  module.exports = require_database();
  module.exports.SqliteError = require_sqlite_error();
});

// node_modules/electron/index.js
var require_electron = __commonJS((exports, module) => {
  var __dirname =
    "/Applications/jepi.okta/hightex-desktop/node_modules/electron";
  var fs = () => ({});
  var path = (init_path(), __toCommonJS(exports_path));
  var pathFile = path.join(__dirname, "path.txt");
  function getElectronPath() {
    let executablePath;
    if (fs.existsSync(pathFile)) {
      executablePath = fs.readFileSync(pathFile, "utf-8");
    }
    if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
      return path.join(
        process.env.ELECTRON_OVERRIDE_DIST_PATH,
        executablePath || "electron",
      );
    }
    if (executablePath) {
      return path.join(__dirname, "dist", executablePath);
    } else {
      throw new Error(
        "Electron failed to install correctly, please delete node_modules/electron and try installing again",
      );
    }
  }
  module.exports = getElectronPath();
});

// electron/database/core/connection.ts
init_path();
var import_better_sqlite3 = __toESM(require_lib(), 1);
var import_electron = __toESM(require_electron(), 1);

class Connection {
  static db;
  static get() {
    if (!this.db) {
      this.db = new import_better_sqlite3.default(
        path_default.join(
          import_electron.app.getPath("userData"),
          "hightex.db",
        ),
      );
    }
    return this.db;
  }
}

// electron/database/core/schema.ts
class ColumnDefinition {
  colType = "TEXT";
  isNullable = false;
  isUnique = false;
  defaultValue = null;
  integer() {
    this.colType = "INTEGER";
    return this;
  }
  text() {
    this.colType = "TEXT";
    return this;
  }
  date() {
    this.colType = "DATE";
    return this;
  }
  json() {
    this.colType = "JSON";
    return this;
  }
  boolean() {
    this.colType = "BOOLEAN";
    return this;
  }
  nullable() {
    this.isNullable = true;
    return this;
  }
  unique() {
    this.isUnique = true;
    return this;
  }
  default(value) {
    this.defaultValue = value;
    return this;
  }
}

class SchemaBuilder {
  static compile(schema, primaryKeyName, primaryKeyType) {
    const columnDefinitions = [];
    if (primaryKeyType === "INTEGER") {
      columnDefinitions.push(
        `${primaryKeyName} INTEGER PRIMARY KEY AUTOINCREMENT`,
      );
    } else {
      columnDefinitions.push(`${primaryKeyName} TEXT PRIMARY KEY`);
    }
    for (const [columnName, def] of Object.entries(schema)) {
      let sqliteType = def.colType;
      if (def.colType === "JSON") sqliteType = "TEXT";
      if (def.colType === "BOOLEAN") sqliteType = "INTEGER";
      const nullability = def.isNullable ? "" : "NOT NULL";
      const uniqueness = def.isUnique ? "UNIQUE" : "";
      let defaultClause = "";
      if (def.defaultValue !== null) {
        if (typeof def.defaultValue === "string") {
          defaultClause = `DEFAULT '${def.defaultValue}'`;
        } else if (typeof def.defaultValue === "boolean") {
          defaultClause = `DEFAULT ${def.defaultValue ? 1 : 0}`;
        } else if (typeof def.defaultValue === "object") {
          defaultClause = `DEFAULT '${JSON.stringify(def.defaultValue)}'`;
        } else {
          defaultClause = `DEFAULT ${def.defaultValue}`;
        }
      }
      columnDefinitions.push(
        `${columnName} ${sqliteType} ${nullability} ${uniqueness} ${defaultClause}`
          .trim()
          .replace(/\s+/g, " "),
      );
    }
    columnDefinitions.push(
      "createdAt TEXT DEFAULT (datetime('now', 'localtime'))",
    );
    return columnDefinitions.join(", ");
  }
}
var table = {
  integer: () => new ColumnDefinition().integer(),
  text: () => new ColumnDefinition().text(),
  date: () => new ColumnDefinition().date(),
  json: () => new ColumnDefinition().json(),
  boolean: () => new ColumnDefinition().boolean(),
};

// electron/database/core/model.ts
class Model {
  connection = Connection.get();
  primaryKeyType = "INTEGER";
  attribute = {};
  bindings = [];
  wheres = [];
  orderClause = "";
  set(field, value) {
    this.attribute[field] = value;
    return this;
  }
  save() {
    this.create(this.attribute);
    this.attribute = {};
  }
  primaryKey() {
    return "id";
  }
  toString() {
    const fields = Object.keys(this.schema).join(", ");
    return `[Model: ${this.constructor.name}] { table: "${this.tableName}", primaryKey: "${String(this.primaryKey())}" (${this.primaryKeyType}), fields: [id, ${fields}, createdAt] }`;
  }
  resetQuery() {
    this.wheres = [];
    this.bindings = [];
    this.orderClause = "";
  }
  boot = () => {
    const columnsSql = SchemaBuilder.compile(
      this.schema,
      String(this.primaryKey()),
      this.primaryKeyType,
    );
    const sql = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columnsSql})`;
    this.connection.prepare(sql).run();
  };
  create(data) {
    const keys = Object.keys(data);
    const columns = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data).map((value) => {
      if (value !== null && typeof value === "object") {
        return JSON.stringify(value);
      }
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      return value;
    });
    const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    return this.connection.prepare(sql).run(values);
  }
  parseRowFields(row) {
    if (!row) return row;
    for (const [columnName, def] of Object.entries(this.schema)) {
      if (row[columnName] !== undefined && row[columnName] !== null) {
        if (def.colType === "JSON" && typeof row[columnName] === "string") {
          try {
            row[columnName] = JSON.parse(row[columnName]);
          } catch (e) {}
        }
        if (def.colType === "DATE" && typeof row[columnName] == "string") {
          try {
            row[columnName] = new Date(row[columnName]);
          } catch (error) {}
        }
        if (def.colType === "BOOLEAN") {
          row[columnName] = row[columnName] === 1;
        }
      }
    }
    return row;
  }
  where(col, arg2, arg3) {
    let operator = "=";
    let value = arg2;
    if (arg3 !== undefined) {
      operator = arg2;
      value = arg3;
    }
    if (value !== null && typeof value === "object") {
      value = JSON.stringify(value);
    }
    if (typeof value === "boolean") {
      value = value ? 1 : 0;
    }
    this.wheres.push(`${String(col)} ${operator} ?`);
    this.bindings.push(value);
    return this;
  }
  orderBy(col, direction = "DESC") {
    this.orderClause = ` ORDER BY ${String(col)} ${direction}`;
    return this;
  }
  get() {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (this.wheres.length > 0) sql += ` WHERE ${this.wheres.join(" AND ")}`;
    if (this.orderClause) sql += this.orderClause;
    const rows = this.connection.prepare(sql).all(this.bindings);
    this.resetQuery();
    return rows.map((row) => this.parseRowFields(row));
  }
  first() {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (this.wheres.length > 0) sql += ` WHERE ${this.wheres.join(" AND ")}`;
    if (this.orderClause) sql += this.orderClause;
    sql += ` LIMIT 1`;
    const row = this.connection.prepare(sql).get(this.bindings);
    this.resetQuery();
    return row ? this.parseRowFields(row) : undefined;
  }
  all() {
    const rows = this.connection
      .prepare(`SELECT * FROM ${this.tableName} ORDER BY createdAt DESC`)
      .all();
    return rows.map((row) => this.parseRowFields(row));
  }
  find(id) {
    const pk = String(this.primaryKey());
    const row = this.connection
      .prepare(`SELECT * FROM ${this.tableName} WHERE ${pk} = ?`)
      .get(id);
    return row ? this.parseRowFields(row) : undefined;
  }
}

// electron/database/models/comments.ts
class Comments extends Model {
  tableName = "comments";
  primaryKeyType = "TEXT";
  schema = {
    data: table.json(),
    type: table.text(),
    text: table.text(),
    documentId: table.text(),
    role: table.text().default("anonymous"),
    participantId: table.text(),
  };
}

// electron/database/core/bootstrapper.ts
class DatabaseBootstraper {
  models = [new Comments()];
  tap() {
    for (const model of this.models) {
      model.boot();
    }
  }
}

// test.ts
new DatabaseBootstraper().tap();
var comment = new Comments();
var data = comment.get();
console.log(data);
