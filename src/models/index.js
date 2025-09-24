// src/models/index.js
const SubscriptionPlan = require('./SubscriptionPlan');
const RestaurantSubscription = require('./RestaurantSubscription');
const SubscriptionLog = require('./SubscriptionLog');
const Restaurant = require('./Restaurant');
const User = require('./User');
const Song = require('./Song');
const Request = require('./Request');
const Favorite = require('./Favorite');
const Playlist = require('./Playlist');
const ListeningHistory = require('./ListeningHistory');
const RestaurantReview = require('./RestaurantReview');
const AuthToken = require('./AuthToken');
const SpotifyToken = require('./SpotifyToken');
const ActivityLog = require('./ActivityLog');
const RestaurantSettings = require('./RestaurantSettings');

module.exports = {
  SubscriptionPlan,
  RestaurantSubscription,
  SubscriptionLog,
  Restaurant,
  User,
  Song,
  Request,
  Favorite,
  Playlist,
  ListeningHistory,
  RestaurantReview,
  AuthToken,
  SpotifyToken,
  ActivityLog,
  RestaurantSettings
};