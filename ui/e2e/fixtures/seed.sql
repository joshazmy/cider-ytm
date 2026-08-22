BEGIN IMMEDIATE;

INSERT INTO settings (key, value)
VALUES (
	'queue_json',
	'{"items":[{"video_id":"LOCAL:/nonexistent/yapel-e2e-current.mp3","title":"Deterministic Current","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"Native E2E","album_id":null,"duration":"3:20","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":false,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false},{"video_id":"LOCAL:/nonexistent/yapel-e2e-upcoming.mp3","title":"Deterministic Upcoming","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"Native E2E","album_id":null,"duration":"4:10","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":true,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false}],"current":0,"playedFrom":0,"repeat":"off","shuffleOrig":null,"radioSeed":null,"sourceName":"Native E2E","radio":false}'
)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO settings (key, value)
VALUES ('local_folders', '__YAPEL_E2E_LOCAL_FOLDERS__')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO lyrics_cache (video_id, lyrics, fetched_at)
VALUES (
	'LOCAL:/nonexistent/yapel-e2e-current.mp3',
	'{"source":"Yapel native fixture","synced":true,"instrumental":false,"lines":[{"time_ms":0,"end_time_ms":9000,"text":"The desk wakes in a quiet rose glow"},{"time_ms":10000,"end_time_ms":19000,"text":"Every control stays close to the song"},{"time_ms":20000,"end_time_ms":29000,"text":"The next line waits without stealing focus"}]}',
	CAST(strftime('%s', 'now') AS INTEGER)
)
ON CONFLICT(video_id) DO UPDATE SET lyrics = excluded.lyrics, fetched_at = excluded.fetched_at;

INSERT INTO plays (video_id, played_at, song_json) VALUES
	('yapel-e2e-repeat-1', CAST(strftime('%s', 'now') AS INTEGER) - 30, '{"video_id":"yapel-e2e-repeat-1","title":"Rose Signal","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"On Repeat Evidence","album_id":null,"duration":"3:11","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":false,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false}'),
	('yapel-e2e-repeat-1', CAST(strftime('%s', 'now') AS INTEGER) - 20, '{"video_id":"yapel-e2e-repeat-1","title":"Rose Signal","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"On Repeat Evidence","album_id":null,"duration":"3:11","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":false,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false}'),
	('yapel-e2e-repeat-2', CAST(strftime('%s', 'now') AS INTEGER) - 10, '{"video_id":"yapel-e2e-repeat-2","title":"Night Geometry","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"On Repeat Evidence","album_id":null,"duration":"4:02","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":false,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false}');

COMMIT;
