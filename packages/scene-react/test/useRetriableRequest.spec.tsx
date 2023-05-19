import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createAlova } from 'alova';
import ReactHook from 'alova/react';
import React, { ReactElement, useEffect, useState } from 'react';
import { mockRequestAdapter } from '~/test/mockData';
import { untilCbCalled, waitForWithFakeTimers } from '~/test/utils';
import { useRetriableRequest } from '..';

const setTimeoutFn = setTimeout;
const alovaInst = createAlova({
  baseURL: 'http://localhost:8080',
  statesHook: ReactHook,
  requestAdapter: mockRequestAdapter
});
afterEach(() => {
  jest.useRealTimers();
});
describe('react => useRetriableRequest', () => {
  test('should not retry when request is success', async () => {
    const methodInstance = alovaInst.Post('/detail');
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();

    const Page = () => {
      const { loading, error, onError, onComplete, onSuccess, onRetry, onFail } = useRetriableRequest(methodInstance);
      onRetry(mockRetryFn);
      onError(mockErrorFn);
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(mockFailFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await screen.findByText(/loaded/);
    expect(mockRetryFn).not.toBeCalled();
    expect(mockErrorFn).not.toBeCalled();
    expect(mockCompleteFn).toBeCalled();
    expect(mockSuccessFn).toBeCalled();
    expect(mockFailFn).not.toBeCalled();
  });

  test('should default retry 3 times and events emit in the right time', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'a',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    const mockLoadingChangeFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, error, onError, onComplete, onSuccess, onRetry, onFail } = useRetriableRequest(methodInstance);
      onRetry(event => {
        mockRetryFn();
        expect(event.sendArgs).toStrictEqual([]);
        expect(event.method).toBe(methodInstance);
        expect(event.retryDelay).toBe(1000);
        expect(event.retryTimes).toBeLessThanOrEqual(3);
      });
      onError(() => {
        mockErrorFn();
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(event => {
        mockFailFn();
        expect(event.sendArgs).toStrictEqual([]);
        expect(event.error).toBeInstanceOf(Error);
        expect(event.method).toBe(methodInstance);
        expect(event.retryTimes).toBe(3);
      });

      useEffect(() => {
        mockLoadingChangeFn();
      }, [loading]);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers(); // 运行模拟请求的setTimeout

    await waitForWithFakeTimers(() => {
      expect(mockErrorFn).toBeCalledTimes(4);
      expect(mockRetryFn).toBeCalledTimes(3);
      expect(mockCompleteFn).toBeCalledTimes(4);
      expect(mockSuccessFn).not.toBeCalled();
      expect(mockFailFn).toBeCalledTimes(1);
      expect(mockLoadingChangeFn).toBeCalledTimes(3); // 分别在初始化、设置为true、恢复为false三次被调用
    });
  });

  test('should stop retry even if not reach maxRetry when request is success', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'aa',
      failTimes: 1
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, error, onError, onRetry, onFail, onComplete, onSuccess } = useRetriableRequest(methodInstance);
      onRetry(mockRetryFn);
      onError(() => {
        mockErrorFn();
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(mockFailFn);

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers(); // 运行模拟请求的setTimeout
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).toBeCalledTimes(1);
      expect(mockErrorFn).toBeCalledTimes(1);
      expect(mockCompleteFn).toBeCalledTimes(2);
      expect(mockSuccessFn).toBeCalledTimes(1);
      expect(mockFailFn).not.toBeCalled();
    });
  });

  test('should retry specific times when set retry with number', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'b',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, error, onError, onRetry, onFail, onComplete, onSuccess } = useRetriableRequest(methodInstance, {
        retry: 2
      });
      onRetry(event => {
        mockRetryFn();
        expect(event.retryTimes).toBeLessThanOrEqual(2);
      });
      onError(() => {
        mockErrorFn();
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(event => {
        mockFailFn();
        expect(event.retryTimes).toBe(2);
      });

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers();
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).toBeCalledTimes(2);
      expect(mockErrorFn).toBeCalledTimes(3);
      expect(mockCompleteFn).toBeCalledTimes(3);
      expect(mockSuccessFn).not.toBeCalled();
      expect(mockFailFn).toBeCalledTimes(1);
    });
  });

  test('should retry when set retry with function which returns true', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'c',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    jest.useFakeTimers();

    let retryTimesCount = 0;
    const Page = () => {
      const { loading, error, onError, onRetry, onFail, onComplete, onSuccess } = useRetriableRequest(methodInstance, {
        retry(error) {
          expect(error).toBeInstanceOf(Error);
          retryTimesCount++;
          return retryTimesCount <= 2;
        }
      });
      onRetry(event => {
        mockRetryFn();
        expect(event.retryTimes).toBeLessThanOrEqual(2);
      });
      onError(() => {
        mockErrorFn();
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(event => {
        mockFailFn();
        expect(event.retryTimes).toBe(2);
      });

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers();
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).toBeCalledTimes(2);
      expect(mockErrorFn).toBeCalledTimes(3);
      expect(mockCompleteFn).toBeCalledTimes(3);
      expect(mockSuccessFn).not.toBeCalled();
      expect(mockFailFn).toBeCalledTimes(1);
    });
  });

  test('should delay the time to retry according to param backoff', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'd',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, error, onRetry, onError } = useRetriableRequest(methodInstance, {
        retry: 2,
        backoff: {
          delay: 300,
          multiplier: 1.5
        }
      });
      onRetry(event => {
        mockRetryFn();
        if (event.retryTimes === 1) {
          expect(event.retryDelay).toBe(300);
        } else if (event.retryTimes === 2) {
          expect(event.retryDelay).toBe(450);
        }
      });
      onError(() => {
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {error ? <span role="error">{error.message}</span> : null}
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers();
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).toBeCalledTimes(2);
    });
  });

  test('retring should effect when call send function', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'f',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, onError, onRetry, onFail, onComplete, onSuccess, send } = useRetriableRequest(methodInstance, {
        retry: 2,
        immediate: false
      });
      onRetry(mockRetryFn);
      onError(() => {
        mockErrorFn();
        act(() => jest.runOnlyPendingTimers()); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(() => {
        mockFailFn();
      });
      const handleSend = () => {
        send().catch(() => {});
      };

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          <button
            role="btn"
            onClick={handleSend}>
            send request
          </button>
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await screen.findByText(/loaded/);
    expect(mockRetryFn).not.toBeCalled();
    expect(mockErrorFn).not.toBeCalled();
    expect(mockCompleteFn).not.toBeCalled();
    expect(mockSuccessFn).not.toBeCalled();
    expect(mockFailFn).not.toBeCalled();

    fireEvent.click(screen.getByRole('btn'));
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers();
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).toBeCalledTimes(2);
      expect(mockErrorFn).toBeCalledTimes(3);
      expect(mockCompleteFn).toBeCalledTimes(3);
      expect(mockSuccessFn).not.toBeCalled();
      expect(mockFailFn).toBeCalledTimes(1);
    });
  });

  test('should stop retry when call stop function manually', async () => {
    const methodInstance = alovaInst.Post('/detail-error', {
      id: 'i',
      failTimes: 5
    });
    const mockRetryFn = jest.fn();
    const mockErrorFn = jest.fn();
    const mockCompleteFn = jest.fn();
    const mockSuccessFn = jest.fn();
    const mockFailFn = jest.fn();
    jest.useFakeTimers();

    const Page = () => {
      const { loading, onError, onRetry, onFail, onComplete, onSuccess, stop } = useRetriableRequest(methodInstance, {
        retry: 4
      });
      onRetry(mockRetryFn);
      onError(() => {
        mockErrorFn();
        act(() => {
          stop();
          jest.runOnlyPendingTimers();
        }); // 运行重试的setTimeout
        setTimeoutFn(() => {
          act(() => jest.runOnlyPendingTimers()); // 运行模拟请求的setTimeout
        }, 10);
      });
      onComplete(mockCompleteFn);
      onSuccess(mockSuccessFn);
      onFail(event => {
        mockFailFn();
        expect(event.error.message).toBe('[alova/useRetriableRequest]stop retry manually');
      });

      return <span role="status">{loading ? 'loading' : 'loaded'}</span>;
    };

    render((<Page />) as ReactElement<any, any>);
    await untilCbCalled(setTimeoutFn, 10);
    jest.runAllTimers();
    await waitForWithFakeTimers(() => {
      expect(mockRetryFn).not.toBeCalled(); // 第一次重试前停止了重试
      expect(mockErrorFn).toBeCalledTimes(1); // 请求失败一次
      expect(mockCompleteFn).toBeCalledTimes(1); // 请求失败一次
      expect(mockSuccessFn).not.toBeCalled();
      expect(mockFailFn).toBeCalledTimes(1); // 手动停止重试也将会立即触发fail事件
    });
  });

  test("should throw error call stop function when isn't requesting", async () => {
    const methodInstance = alovaInst.Post('/detail');
    const Page = () => {
      const [stopError, setStopError] = useState(undefined as undefined | Error);
      const { loading, stop } = useRetriableRequest(methodInstance);
      const handleStop = () => {
        try {
          act(() => stop());
        } catch (error: any) {
          setStopError(error);
        }
      };

      return (
        <div>
          <span role="status">{loading ? 'loading' : 'loaded'}</span>
          {stopError ? <span role="error">{stopError.message}</span> : null}
          <button
            role="btnStop"
            onClick={handleStop}>
            stop retry
          </button>
        </div>
      );
    };

    render((<Page />) as ReactElement<any, any>);
    await screen.findByText('loaded');
    act(() => {
      fireEvent.click(screen.getByRole('btnStop'));
    });
    expect(screen.getByRole('error')).toHaveTextContent(
      '[alova/useRetriableRequest]there are no requests being retried'
    );
  });
});
