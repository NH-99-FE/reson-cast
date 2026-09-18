export const connections = []
export class Realtime {
  constructor(options) {
    this.options = options
    this.listeners = []
    this.closed = false
    this.channel = {
      state: 'initialized',
      listeners: {},
      off: () => {
        this.channel.listeners = {}
      },
      unsubscribe: () => {
        this.receive = undefined
      },
      on: (name, callback) => {
        this.channel.listeners[name] = callback
      },
      subscribe: async callback => {
        this.receive = callback
        queueMicrotask(() => {
          this.channel.state = 'attached'
          this.channel.listeners.attached?.()
        })
      },
    }
    this.channels = {
      get: name => {
        this.channelName = name
        return this.channel
      },
    }
    this.connection = {
      on: callback => {
        this.listeners.push(callback)
      },
      off: () => {
        this.listeners = []
      },
    }
    connections.push(this)
    queueMicrotask(() => options.authCallback({}, () => this.change('connected')))
  }
  change(current) {
    this.listeners.forEach(callback => callback({ current }))
  }
  send(event) {
    this.receive?.({ data: event })
  }
  close() {
    this.closed = true
  }
}
