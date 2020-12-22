(function () {
  var STATUS_PENDING = 'pending';
  var STATUS_RESOLVED = 'resolved';
  var STATUS_REJECTED = 'rejected';

  function MyPromise(executor) {
    var _this = this;
    _this.status = STATUS_PENDING;
    _this.value = undefined; // 用来保存正确的值
    _this.reason = undefined; // 用来保存错误的值
    // { onResolved: function () {}, onRejected: function () {}, onFinalyed: function () {} }
    // 这里为什么要使用数组保存呢？
    //   因为在状态改变前，有可能绑定多个回调
    //   例如: var mp = new MyPromise(); mp.then(...); mp.then(...); 这里就使用同一个 mp 对象调用了两次 then 方法
    _this.callbacks = [];

    function changeStatus(status, valueOrReason) {
      if (_this.status !== STATUS_PENDING) return;
      _this.status = status;
      const isToResolved = status === STATUS_RESOLVED;
      if (isToResolved) {
        _this.value = valueOrReason;
      } else {
        _this.reason = valueOrReason;
      }
      // 如果指定了成功或失败的回调，则需要异步调用其回调函数
      if (_this.callbacks.length > 0) {
        // 用 setTimeout 0 模拟 微任务
        setTimeout(function () {
          _this.callbacks.forEach(function (v) {
            if (isToResolved) {
              v.onResolved(valueOrReason);
            } else {
              v.onRejected(valueOrReason);
            }
          });
        }, 0);
      }
    }

    function resovle(value) {
      if (_this.status !== STATUS_PENDING) return;

      // 如果 value 又是一个 MyPromise 对象，那么 value 的状态会决定 new 出来的这个 MyPromise 对象的状态
      if (value instanceof MyPromise) {
        value
          .then(
            function (value) {
              return value;
            },
            function (reason) {
              throw reason;
            },
          )
          .then(
            function (value) {
              changeStatus(STATUS_RESOLVED, value);
              // _this.status = STATUS_RESOLVED;
              // _this.value = value;
              // // 如果指定了成功或失败的回调
              // if (_this.callbacks.length > 0) {
              //   // 用 setTimeout 0 模拟 微任务
              //   setTimeout(function () {
              //     _this.callbacks.forEach(function (v) {
              //       v.onResolved(value);
              //     });
              //   }, 0);
              // }
            },
            function (reason) {
              changeStatus(STATUS_REJECTED, reason);
              // _this.status = STATUS_REJECTED;
              // _this.reason = reason;
              // // 如果指定了成功或失败的回调
              // if (_this.callbacks.length > 0) {
              //   // 用 setTimeout 0 模拟 微任务
              //   setTimeout(function () {
              //     _this.callbacks.forEach(function (v) {
              //       v.onRejected(reason);
              //     });
              //   }, 0);
              // }
            },
          );
      } else {
        changeStatus(STATUS_RESOLVED, value);
        // _this.status = STATUS_RESOLVED;
        // _this.value = value;
        // // 如果指定了成功或失败的回调
        // if (_this.callbacks.length > 0) {
        //   // 用 setTimeout 0 模拟 微任务
        //   setTimeout(function () {
        //     _this.callbacks.forEach(function (v) {
        //       v.onResolved(value);
        //     });
        //   }, 0);
        // }
      }
    }

    function reject(reason) {
      changeStatus(STATUS_REJECTED, reason);
      // if (_this.status !== STATUS_PENDING) return;
      // _this.status = STATUS_REJECTED;
      // _this.reason = reason;
      // // 如果指定了成功或失败的回调
      // if (_this.callbacks.length > 0) {
      //   setTimeout(function () {
      //     _this.callbacks.forEach(function (v) {
      //       v.onRejected(reason);
      //     });
      //   }, 0);
      // }
    }

    try {
      executor(resovle, reject);
    } catch (err) {
      reject(err);
    }
  }

  MyPromise.prototype.then = function (onResolved, onRejected) {
    // then会返回一个新的MyPromise实例，该MyPromise实例的状态会根据上一个then函数指定的回调函数的返回值来决定
    var _this = this;

    if (!(onResolved instanceof Function)) {
      onResolved = function (value) {
        return value;
      };
    }

    if (!(onRejected instanceof Function)) {
      onRejected = function (reason) {
        throw reason;
      };
    }

    return new MyPromise(function (resolve, reject) {
      // 用来处理 新创建出来的 MyPromise 实例的状态的
      function handle(callback, arg) {
        var result = undefined;
        try {
          result = callback(arg);
        } catch (err) {
          reject(err);
          return;
        }
        // 如果该返回值（result）是一个 MyPromise 实例，
        if (result instanceof MyPromise) {
          // 那么 result 的状态会决定 then 函数创建出来的新的MyPromise实例的状态
          result.then(resolve, reject);
        }
        // 如果该返回值(result)不是一个 MyPromise 实例，
        else {
          // 则将 then 函数创建出来的新的MyPromise实例的标记为 resolved，并将这个result作为正确的值传递下去
          resolve(result);
        }
      }

      // 如果当前实例的状态是pending，那么不能调用，要先保存起来
      if (_this.status === STATUS_PENDING) {
        _this.callbacks.push({
          onResolved: function (value) {
            handle(onResolved, value);
          },
          onRejected: function (reason) {
            handle(onRejected, reason);
          },
        });
      } else if (_this.status === STATUS_RESOLVED) {
        // 如果当前实例的状态是resolved，那么就将成功的回调推入微任务队列
        setTimeout(function () {
          handle(onResolved, _this.value);
        }, 0);
      } else {
        // 如果当前实例的状态是rejected，那么就将失败的回调推入微任务队列
        setTimeout(function () {
          handle(onRejected, _this.reason);
        }, 0);
      }
    });
  };

  MyPromise.prototype.catch = function (onRejected) {
    return this.then(undefined, onRejected);
  };

  // 不管成功或失败，都执行
  MyPromise.prototype.finally = function (callback) {
    return this.then(
      function (value) {
        callback();
        return value;
      },
      function (reason) {
        callback();
        throw reason;
      },
    );
  };

  // 返回一个新的MyPromsie实例，等接收的所有MyPromise成功后，才标记为成功，拿到所有的结果（顺序和promises一致），如果有一个失败，则立即标记为失败
  MyPromise.all = function (promises) {
    var values = []; // 用来保存所有Promise的value
    var successCount = 0; // 用来保存成功的个数
    return new MyPromise(function (resolve, reject) {
      promises.forEach(function (v, i) {
        (v instanceof MyPromise ? v : MyPromise.resolve(v)).then(function (
          value,
        ) {
          // values.push(value); 1/2/3
          values[i] = value;
          successCount++;
          if (successCount === promises.length) {
            resolve(values);
          }
        },
        reject);
      });
    });
  };

  // 返回一个新的MyPromise实例，接收的 promises 数组中，最快的那一个Promise的状态，决定该Promise的状态
  MyPromise.race = function (promises) {
    return new MyPromise(function (resolve, reject) {
      promises.forEach(function (v) {
        (v instanceof MyPromise ? v : MyPromise.resolve(v)).then(
          resolve,
          reject,
        );
      });
    });
  };

  // 创建一个新的MyPromise实例
  //  如果value为MyPromise实例，则value的状态决定新创建的MyPromise实例的状态
  //  如果value不为MyPromise实例，则立即标记为成功，并将该value做为成功的值
  MyPromise.resolve = function (value) {
    return new MyPromise(function (resolve, reject) {
      if (value instanceof MyPromise) {
        value.then(resolve, reject);
      } else {
        resolve(value);
      }
    });
  };

  // 创建一个新的MyPromise实例，立即标记为失败，并将该reason做为失败的值
  MyPromise.reject = function (reason) {
    return new MyPromise(function (resolve, reject) {
      reject(reason);
    });
  };

  // 创建一个延迟ms毫秒后再标记为resolved的MyPromise对象
  MyPromise.delayResolve = function (value, ms) {
    return new MyPromise(function (resolve, reject) {
      setTimeout(function () {
        if (value instanceof MyPromise) {
          value.then(resolve, reject);
        } else {
          resolve(value);
        }
      }, ms);
    });
  };

  // 创建一个延迟ms毫秒后再标记为rejected的MyPromise对象
  MyPromise.delayReject = function (reason, ms) {
    return new MyPromise(function (resolve, reject) {
      setTimeout(function () {
        reject(reason);
      }, ms);
    });
  };

  window.MyPromise = MyPromise;
})();
