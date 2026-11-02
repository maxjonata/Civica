CREATE TABLE IF NOT EXISTS civica_pilot_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO civica_pilot_state (id, state_json)
VALUES (1, '{"version":1,"accounts":[],"passkeys":[],"sessions":[],"contexts":[],"challenges":[],"invites":[],"enrollments":[],"rates":[],"adminBootstrapped":false}');
