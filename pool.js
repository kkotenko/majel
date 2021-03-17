/**
 * Copyright 2019-2021 John H. Nguyen
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

const { redis } = require("./redis")

// a pool has:
// String guildId: the id of the guild
// String name
// int value
// String header: the header to use for the embed
// int color: the discord.js color to use as the embed color
// String channelId: the channelId if the pool is local to a channel, "global" otherwise 

class Pool {
  constructor(guildId, name, value, header, color, channelId) {
    this.guildId = guildId
    this.name = name
    this.value = value
    this.header = header
    this.color = color
    this.channelId = (channelId ? channelId : "global")
  }

  // ensure lower bound for value
  // ensure upper bound for value

  modifyValue(op, amount) {

        if (op === "add") {
          this.value += amount
        } else if (op === "sub") {
          this.value -= amount
        } else if (op === "set") {
          this.value = amount
        } else {
          return false
        }
        return true
  }

}
module.exports = {
  async status(msg, option) {
    const guildId = msg.guild.id.toString()
    const channelId = msg.channel.id.toString()
    const isAdmin = msg.member.hasPermission("ADMINISTRATOR")
    console.warn(msg.author.username)
    console.warn("guild id", guildId)
    console.warn("channel id", channelId)

    let guildData = await redis.get(guildId)
    if (guildData) {
      guildData = JSON.parse(guildData)
    }

    console.warn("get redis", guildId, guildData)
    if (!guildData || !guildData.global) {
      console.warn("fixing guildData")
      guildData = {
        global: {
          momentum: 0,
          threat: 0,
          shippower: 0,
        },
      }
    }

    const global = guildData.global
    // making sure global is always first to be displayed
    const embed = {
      title: "Momentum, Threat and Ship Power Pools",
      fields: [
        {
          name: "Global",
          value: `Momentum: ${global.momentum}. Threat: ${global.threat}. Ship power: ${global.shippower}`,
        },
      ],
    }

    let reset = false
    let thisChannelOnly = false
    const options = option.split(" ")
    console.warn("option", options)
    if (options.length > 1) {
      reset = options[0].toLowerCase() === "reset"
      thisChannelOnly = options[1].toLowerCase() === "here"
    } else if (options.length > 0) {
      const op = options[0].toLowerCase()
      reset = op.toLowerCase() === "reset"
      thisChannelOnly = op.toLowerCase() === "here"
    }

    if (reset) {
      for (let currentId in guildData) {
        console.warn("currentId", currentId)
        if (!thisChannelOnly && currentId === "global") {
          guildData.global.momentum = 0
          guildData.global.threat = 0
          guildData.global.shippower = 0
          continue
        }

        if (thisChannelOnly && currentId !== channelId) {
          continue
        }

        console.warn("deleting", currentId)
        delete guildData[currentId]
      }
    }

    for (let currentId in guildData) {
      console.warn("currentId", currentId)
      if (currentId === "global") {
        continue
      }

      if (!reset && thisChannelOnly && currentId !== channelId) {
        continue
      }

      const channel = guildData[currentId]
      console.warn("channel", channel)
      if (channel) {
        embed.fields.push({
          name: `#${channel.name}`,
          value: `Momentum: ${channel.momentum}. Threat: ${channel.threat}. Ship power: ${channel.shippower}`,
        })
      }
    }


    console.warn("set redis", guildData)
    await redis.set(guildId, JSON.stringify(guildData))
    return embed
  },
  async adjustMomentum(msg, option) {
    const guildId = msg.guild.id.toString()
    const channelId = msg.channel.id.toString()

    let guildData = await redis.get(guildId)
    if (guildData) {
      guildData = JSON.parse(guildData)
    }

    console.warn("get redis", guildId, guildData)
    if (!guildData || !guildData.global) {
      console.warn("fixing guildData")
      guildData = {
        global: {
          momentum: 0,
          threat: 0,
          shippower: 0,
        },
      }
    }

    if (!guildData[channelId]) {
      guildData[channelId] = {
        momentum: 0,
        threat: 0,
        shippower: 0,
        name: msg.channel.name,
      }
    }
    // TODO: think about with which value to initialize: prolly sth from guildData
    global.momentum = new Pool(guildId, "Momentum", 0, "Global", 3447003, "NONE")
    
    const options = option.split(" ")

    let op = ""
    if (options.length > 0) {
      op = options[0].toLowerCase()
      const amount = parseInt(options[1])
      const isChannelPool =
        options.length >= 3 && options[2].toLowerCase() === "here"

      let pool = "global"
      if (isChannelPool) {
        pool = channelId
      }

      
      global.momentum.modifyValue(op, amount)

      if (guildData.global.momentum > 6) {
        guildData.global.momentum = 6
      }

      if (guildData.global.momentum < 0) {
        guildData.global.momentum = 0
      }
    }

    const embed = {
      title: "Momentum Pools",
      color: 3447003,
      fields: [
        {
          name: "Global",
          value: guildData.global.momentum,
          inline: true,
        },
        {
          name: `#${msg.channel.name}`,
          value: guildData[channelId].momentum,
          inline: true,
        },
      ],
    }


    console.warn("redis set", guildId, guildData)
    await redis.set(guildId, JSON.stringify(guildData))
    return embed
  },
  async adjustThreat(msg, option) {
    const guildId = msg.guild.id.toString()
    const channelId = msg.channel.id.toString()

    let guildData = await redis.get(guildId)
    if (guildData) {
      guildData = JSON.parse(guildData)
    }

    console.warn("get redis", guildId, guildData)
    if (!guildData || !guildData.global) {
      console.warn("fixing guildData")
      guildData = {
        global: {
          momentum: 0,
          threat: 0,
          shippower: 0,
        },
      }
    }

    if (!guildData[channelId]) {
      guildData[channelId] = {
        momentum: 0,
        threat: 0,
        shippower: 0,
        name: msg.channel.name,
      }
    }

    const options = option.split(" ")

    let op = ""
    if (options.length > 0) {
      op = options[0].toLowerCase()
      const amount = parseInt(options[1])
      const isChannelPool =
        options.length >= 3 && options[2].toLowerCase() === "here"

      let pool = "global"
      if (isChannelPool) {
        pool = channelId
      }

      if (guildData[pool].threat === null) {
        guildData[pool].threat = 0;
      }

      if (op === "add") {
        guildData[pool].threat += amount
      } else if (op === "sub") {
        guildData[pool].threat -= amount
      } else if (op === "set") {
        guildData[pool].threat = amount
      }

        if (guildData.global.threat < 0 || guildData.global.threat === null) {
          guildData.global.threat = 0
        }
    }

    const embed = {
      title: "Threat Pools",
      color: 15158332,
      fields: [
        {
          name: "Global",
          value: guildData.global.threat,
          inline: true,
        },
        {
          name: `#${msg.channel.name}`,
          value: guildData[channelId].threat,
          inline: true,
        },
      ],
    }


    await redis.set(guildId, JSON.stringify(guildData))
    return embed
  },
  async adjustShipPower(msg, option) {
    const guildId = msg.guild.id.toString()
    const channelId = msg.channel.id.toString()

    let guildData = await redis.get(guildId)
    if (guildData) {
      guildData = JSON.parse(guildData)
    }

    console.warn("get redis", guildId, guildData)
    if (!guildData || !guildData.global) {
      console.warn("fixing guildData")
      guildData = {
        global: {
          momentum: 0,
          threat: 0,
          shippower: 0,
        },
      }
    }

    if (!guildData[channelId]) {
      guildData[channelId] = {
        momentum: 0,
        threat: 0,
        shippower: 0,
        name: msg.channel.name,
      }
    }

    const options = option.split(" ")

    let op = ""
    if (options.length > 0) {
      op = options[0].toLowerCase()
      const amount = parseInt(options[1])
      const isChannelPool =
        options.length >= 3 && options[2].toLowerCase() === "here"

      let pool = "global"
      if (isChannelPool) {
        pool = channelId
      }

      if (guildData[pool].shippower === null) {
        guildData[pool].shippower = 0;
      }

      if (op === "add") {
        guildData[pool].shippower += amount
      } else if (op === "sub") {
        guildData[pool].shippower -= amount
      } else if (op === "set") {
        guildData[pool].shippower = amount
      }

      if (guildData.global.shippower < 0 || guildData.global.shippower === null) {
        guildData.global.shippower = 0
      }
      console.warn(guildData.global.shippower)
    }

    const embed = {
      title: "Ship Power Pools",
      color: 15844367, // 15844367 = GOLD
      fields: [
        {
          name: "Global",
          value: guildData.global.shippower,
          inline: true,
        },
        {
          name: `#${msg.channel.name}`,
          value: guildData[channelId].shippower,
          inline: true,
        },
      ],
    }

    await redis.set(guildId, JSON.stringify(guildData))
    return embed
  }
}
