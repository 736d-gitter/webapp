local user_badge_key = KEYS[1]
local user_troupe_key = KEYS[2]
local email_hash_key = KEYS[3]
local user_troupe_mention_key = KEYS[4]
local user_mention_key = KEYS[5]
local user_email_latch_key = KEYS[6];

local troupe_id = table.remove(ARGV, 1)
local user_id = table.remove(ARGV, 1)

local key_type = redis.call("TYPE", user_troupe_key)["ok"];

local result = {}
local flag = 0

if redis.call("DEL", user_troupe_key) > 0 then
  flag = 1
end

if redis.call("DEL", user_troupe_mention_key) > 0 then
  flag = 1
end

if redis.call("ZREM", user_badge_key, troupe_id) > 0 then
  flag = 1
end

redis.call("DEL", user_email_latch_key);
redis.call("HDEL", email_hash_key, troupe_id..':'..user_id)

return flag
