local user_badge_key = KEYS[1]
local user_troupe_key = KEYS[2]
local email_hash_key = KEYS[3]

-- Values are lrt timestamp, troupeId followed by itemIds,
local troupe_id = table.remove(ARGV, 1)
local user_id = table.remove(ARGV, 1)
local itemIds = ARGV

local key_type = redis.call("TYPE", user_troupe_key)["ok"];

local result = {}
local flag = 0
local card = -1

for i, item_id in ipairs(itemIds) do

  local removed;

  if key_type == "set" then
    removed = redis.call("SREM", user_troupe_key, item_id)
    if removed > 0 then
      card = redis.call("SCARD", user_troupe_key)
    end
  elseif key_type == "none" then
    removed = 0;
  else
    removed = redis.call("ZREM", user_troupe_key, item_id)

    if removed > 0 then
      card = redis.call("ZCARD", user_troupe_key)
    end
  end

	-- If this item has not already been removed.....
	if removed > 0 then
		-- Then we need to decrement the ZSET for this user for this troupe

		-- If this is the first for this troupe for this user, the badge count is going to increment
		if tonumber(redis.call("ZINCRBY", user_badge_key, -1, troupe_id)) <= 0 then
			redis.call("ZREMRANGEBYSCORE", user_badge_key, '-inf', 0)
			flag = 1
		end
	end
end

-- Remove this user from the list of people who may get an email
redis.call("HDEL", email_hash_key, troupe_id..':'..user_id)

table.insert(result, card)
table.insert(result, flag)

return result