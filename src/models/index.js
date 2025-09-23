// src/models/index.js
const SubscriptionPlan = require('./SubscriptionPlan');
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

module.exports = {
  SubscriptionPlan,
  Restaurant,
  User,
  Song,
  Request,
  Favorite,
  Playlist,
  ListeningHistory,
  RestaurantReview,
  AuthToken,
  SpotifyToken
};