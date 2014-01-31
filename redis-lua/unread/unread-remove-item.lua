-- Keys are user:troupe keys follows by user:count keys
-- Values are [troupeId, itemId]
local troupe_id = ARGV[1]
local item_id = ARGV[2];

local key_count = #KEYS/3


local result = {}

for i = 1,key_count do
	local index = i * 3;
	local user_troupe_key = KEYS[index]
	local user_badge_key = KEYS[index + 1]
	local user_mention_key = KEYS[index + 2]

	local key_type = redis.call("TYPE", user_troupe_key)["ok"]

	local removed;										-- number of items remove
	local card = -1; 									-- count post remove
	local flag = 0;                   -- flag 1 means update user badge

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

	-- No unread items implies no mentions either
	if card == 0 then
		card = redis.call("DEL", user_mention_key)
	end

	-- If this item has not already been removed.....
	if removed > 0 then
		-- Then we need to decrement the ZSET for this user for this troupe

		-- If this is the first for this troupe for this user, the badge count is going to increment
		if tonumber(redis.call("ZINCRBY", user_badge_key, -1, troupe_id)) <= 0 then
			redis.call("ZREMRANGEBYSCORE", user_badge_key, '-inf', 0)
			flag = 1;
		end
	end

	table.insert(result, card)
	table.insert(result, flag)
end

return result