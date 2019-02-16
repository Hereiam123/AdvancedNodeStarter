const mongoose = require("mongoose");
const exec = mongoose.Query.prototype.exec;
const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
client.get = util.promisify(client.get);

mongoose.Query.prototype.cache = function() {
  this._cache = true;
  return this;
};

mongoose.Query.prototype.exec = async function() {
  if (!this._cache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  //Check if we have value for the key in redis
  const cacheValue = await client.get(key);

  if (cacheValue) {
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  //Get mongo db call and apply to redis
  const result = await exec.apply(this, arguments);
  client.set(key, JSON.stringify(result));
  return result;
};
