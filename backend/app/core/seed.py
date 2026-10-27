"""Reference data shared by the initial migration and the test suite."""

GAMES = [
    {"name": "Bhabhi Thulla", "slug": "bhabhi-thulla", "description": "The classic South Asian shedding game.", "min_players": 3, "max_players": 6, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Court Piece", "slug": "court-piece", "description": "Partnership trick-taking game, also known as Rang.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "29", "slug": "29", "description": "32-card point-trick game with bidding.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Seep", "slug": "seep", "description": "Fishing game with houses and sweeps.", "min_players": 2, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Call Break", "slug": "call-break", "description": "Trick-taking with spades as permanent trumps.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Hokm", "slug": "hokm", "description": "Persian partnership trick-taking game.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Tarneeb", "slug": "tarneeb", "description": "Levantine bidding and trick-taking game.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Baloot", "slug": "baloot", "description": "Gulf partnership game with Sun and Hokm contracts.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": True},
    {"name": "Spades", "slug": "spades", "description": "Partnership classic where spades are always trumps.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": False},
    {"name": "Hearts", "slug": "hearts", "description": "Avoid hearts and the Queen of Spades.", "min_players": 4, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": False},
    {"name": "Thirteen", "slug": "thirteen", "description": "Vietnamese climbing game: beat the table, bomb the 2s, shed every card.", "min_players": 2, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": False},
    {"name": "Rummy", "slug": "rummy", "description": "Classic draw-and-discard game: meld sets and runs, lay off, go out first.", "min_players": 2, "max_players": 4, "bot_enabled": True, "multiplayer_enabled": False, "is_available": True, "is_regional": False},
]

ACHIEVEMENTS = [
    {"code": "first_victory", "name": "First Victory", "description": "Win your first game.", "icon": "🏅", "requirement": {"type": "games_won", "count": 1}},
    {"code": "first_multiplayer", "name": "First Multiplayer Game", "description": "Finish a multiplayer game.", "icon": "🌐", "requirement": {"type": "multiplayer_played", "count": 1}},
    {"code": "played_10", "name": "Getting Started", "description": "Play 10 games.", "icon": "🎴", "requirement": {"type": "games_played", "count": 10}},
    {"code": "played_50", "name": "Regular", "description": "Play 50 games.", "icon": "🃏", "requirement": {"type": "games_played", "count": 50}},
    {"code": "won_100", "name": "Centurion", "description": "Win 100 games.", "icon": "💯", "requirement": {"type": "games_won", "count": 100}},
    {"code": "streak_10", "name": "Unstoppable", "description": "Win 10 games in a row.", "icon": "🔥", "requirement": {"type": "win_streak", "count": 10}},
    {"code": "bhabhi_master", "name": "Bhabhi Thulla Master", "description": "Win 25 games of Bhabhi Thulla.", "icon": "👑", "requirement": {"type": "game_won", "game": "bhabhi-thulla", "count": 25}},
    {"code": "court_piece_master", "name": "Court Piece Master", "description": "Win 25 games of Court Piece.", "icon": "♥️", "requirement": {"type": "game_won", "game": "court-piece", "count": 25}},
    {"code": "regional_champion", "name": "Regional Card Champion", "description": "Win at least one game in three different regional games.", "icon": "🌏", "requirement": {"type": "regional_games_won", "count": 3}},
]
