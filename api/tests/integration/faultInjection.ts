import prisma from '../../src/lib/prisma'

type Delegate = Record<string, unknown>
type FailWhen = (model: string, method: string, args: unknown) => boolean

/**
 * Makes one operation *inside* the next interactive transactions throw, to prove the whole
 * transaction rolls back. Returns a restore function.
 */
export function failInsideTransactions(failWhen: FailWhen) {
  const real = prisma.$transaction.bind(prisma) as (
    fn: (tx: unknown) => Promise<unknown>,
    options?: unknown
  ) => Promise<unknown>

  const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((
    fn: (tx: unknown) => Promise<unknown>,
    options?: unknown
  ) =>
    real(
      (tx) =>
        fn(
          new Proxy(tx as Record<string, unknown>, {
            get(target, model: string) {
              const delegate = target[model]
              if (!delegate || typeof delegate !== 'object') return delegate
              return new Proxy(delegate as Delegate, {
                get(d, method: string) {
                  const original = d[method]
                  if (typeof original !== 'function') return original
                  return (args: unknown) => {
                    if (failWhen(model, method, args)) {
                      throw new Error(`injected failure in ${model}.${method}`)
                    }
                    return (original as (a: unknown) => unknown).call(d, args)
                  }
                },
              })
            },
          })
        ),
      options
    )) as never)

  return () => spy.mockRestore()
}
