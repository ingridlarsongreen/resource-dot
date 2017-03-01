'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

window.app = angular.module('FullstackGeneratedApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate', 'ngMaterial', 'infinite-scroll', 'ui.sortable']);

if (!window.TESTING) {
  // Why we don't want this block to run if we're in the testing mode: this block makes re-routes the page to home page ($urlRouterProvider.otherwise('/')); this additional request doesn't get handled in the front-end testing files--the front-end tests will think that they failed
  app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
    // Trigger page refresh when accessing an OAuth route
    $urlRouterProvider.when('/auth/:provider', function () {
      window.location.reload();
    });
  });
}
// This app.run is for listening to errors broadcasted by ui-router, usually originating from resolves
app.run(function ($rootScope) {
  $rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, thrownError) {
    console.info('The following error was thrown by ui-router while transitioning to state "' + toState.name + '". The origin of this error is probably a resolve function:');
    console.error(thrownError);
  });
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

  // The given state requires an authenticated user.
  var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
    return state.data && state.data.authenticate;
  };

  // $stateChangeStart is an event fired
  // whenever the process of changing a state begins.
  $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {
    if (!destinationStateRequiresAuth(toState)) {
      // The destination state does not require authentication
      // Short circuit with return.
      return;
    }

    if (AuthService.isAuthenticated()) {
      // The user is authenticated.
      // Short circuit with return.
      return;
    }

    // Cancel navigating to new state.
    event.preventDefault();

    AuthService.getLoggedInUser().then(function (user) {
      // If a user is retrieved, then renavigate to the destination
      // (the second time, AuthService.isAuthenticated() will work)
      // otherwise, if no user is logged in, go to "login" state.
      if (user) {
        $state.go(toState.name, toParams);
      } else {
        $state.go('login');
      }
    });
  });
});

app.config(function ($stateProvider) {
  $stateProvider.state('friend', {
    url: '/friends/:friendId',
    templateUrl: 'js/friend/friend.html',
    controller: 'friendCtrl'
  });
});

app.controller('friendCtrl', function ($scope, $state, UserFactory, $stateParams, GuideFactory, AuthService, $log) {
  UserFactory.getById($stateParams.friendId).then(function (friend) {
    $scope.friend = friend;
    return AuthService.getLoggedInUser();
  }).then(function (user) {
    if (!user) {
      $scope.user = { id: 0, name: 'Guest', friend: [], resourceLikes: [], resourceDislikes: [], guideLikes: [], guideDislikes: [] };
    } else {
      return UserFactory.getById(user.id).then(function (foundUser) {
        $scope.user = foundUser;
        $scope.userFriends = foundUser.friend;
        $scope.userFriendsIds = $scope.userFriends.map(function (userFriend) {
          return userFriend.id;
        });
        $scope.loaded = true;
      });
    }
  }).catch($log.error);

  GuideFactory.getByAuthor($stateParams.friendId).then(function (guides) {
    $scope.guides = guides;
  }).catch($log.error);

  $scope.follow = function (friendId) {
    return UserFactory.addFriend($scope.user.id, { friendId: friendId }).then(function () {
      $scope.userFriendsIds.push(friendId);
    }).catch($log.error);
  };

  $scope.search = function (tagId) {
    $state.go('searchResults', { tagIds: tagId });
  };

  $scope.unfollow = function (friendId) {
    return UserFactory.deleteFriend($scope.user.id, friendId).then(function () {
      var index = $scope.userFriendsIds.indexOf(friendId);
      if (index > -1) {
        $scope.userFriendsIds.splice(index, 1);
      }
    }).catch($log.error);
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('friends', {
    url: '/:userId/friends/all',
    templateUrl: 'js/friends/friends.html',
    controller: 'friendsCtrl'
  });
});

app.controller('friendsCtrl', function ($scope, $state, UserFactory, $stateParams, $log) {
  UserFactory.getById($stateParams.userId).then(function (user) {
    $scope.user = user;
    $scope.friends = user.friend;
  }).catch($log.error);

  $scope.findFriend = function (friendId) {
    $state.go('friend', { friendId: friendId });
  };
});

(function () {

  'use strict';

  // Hope you didn't forget Angular! Duh-doy.

  if (!window.angular) throw new Error('I can\'t find Angular!');

  var app = angular.module('fsaPreBuilt', []);

  app.factory('Socket', function () {
    if (!window.io) throw new Error('socket.io not found!');
    return window.io(window.location.origin);
  });

  // AUTH_EVENTS is used throughout our app to
  // broadcast and listen from and to the $rootScope
  // for important events about authentication flow.
  app.constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
  });

  app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
    var statusDict = {
      401: AUTH_EVENTS.notAuthenticated,
      403: AUTH_EVENTS.notAuthorized,
      419: AUTH_EVENTS.sessionTimeout,
      440: AUTH_EVENTS.sessionTimeout
    };
    return {
      responseError: function responseError(response) {
        $rootScope.$broadcast(statusDict[response.status], response);
        return $q.reject(response);
      }
    };
  });

  app.config(function ($httpProvider) {
    $httpProvider.interceptors.push(['$injector', function ($injector) {
      return $injector.get('AuthInterceptor');
    }]);
  });

  app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

    function onSuccessfulLogin(response) {
      var user = response.data.user;
      Session.create(user);
      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
      return user;
    }

    // Uses the session factory to see if an
    // authenticated user is currently registered.
    this.isAuthenticated = function () {
      return !!Session.user;
    };

    this.getLoggedInUser = function (fromServer) {

      // If an authenticated session exists, we
      // return the user attached to that session
      // with a promise. This ensures that we can
      // always interface with this method asynchronously.

      // Optionally, if true is given as the fromServer parameter,
      // then this cached value will not be used.

      if (this.isAuthenticated() && fromServer !== true) {
        return $q.when(Session.user);
      }

      // Make request GET /session.
      // If it returns a user, call onSuccessfulLogin with the response.
      // If it returns a 401 response, we catch it and instead resolve to null.
      return $http.get('/session').then(onSuccessfulLogin).catch(function () {
        return null;
      });
    };

    this.login = function (credentials) {
      return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
        return $q.reject({ message: 'Invalid login credentials.' });
      });
    };

    this.logout = function () {
      return $http.get('/logout').then(function () {
        Session.destroy();
        $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
      });
    };

    this.signup = function (signUpInfo) {
      return $http.post('/signup', signUpInfo).then(onSuccessfulLogin).catch(function () {
        return $q.reject({ message: 'Invalid signup credentials.' });
      });
    };
  });

  app.service('Session', function ($rootScope, AUTH_EVENTS) {

    var self = this;

    $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
      self.destroy();
    });

    $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
      self.destroy();
    });

    this.user = null;

    this.create = function (user) {
      this.user = user;
    };

    this.destroy = function () {
      this.user = null;
    };
  });
})();

app.config(function ($stateProvider) {
  $stateProvider.state('guideDetail', {
    url: '/guide/:id',
    templateUrl: 'js/guide_detail/guide.html',
    controller: 'GuideCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest', friend: [], resourceLike: [], resourceDislike: [], guideLike: [], guideDislike: [] };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('GuideCtrl', function ($scope, GuideFactory, $log, $mdToast, $state, user, $stateParams) {
  $scope.user = user;
  GuideFactory.getById($stateParams.id).then(function (guide) {
    $scope.guide = guide;
    $scope.author = guide.author;
    $scope.resources = guide.resources.sort(function (a, b) {
      if (b.order > a.order) {
        return -1;
      }
      if (a.order > b.order) {
        return 1;
      }
      return 0;
    });
  }).catch($log.error);

  $scope.deleteGuide = function (id) {
    return GuideFactory.delete(id).then(function () {
      $state.go('profile');
    });
  };
  $scope.sortableOptions = {};

  $scope.updateOrder = function () {
    var newOrder = $scope.resources.map(function (resource) {
      return resource.id;
    });
    GuideFactory.updateOrder($scope.guide.id, newOrder).then(function () {
      $mdToast.show($mdToast.simple().textContent('Guide updated!'));
    }).catch($log.error);
  };
});

app.controller('HomeCtrl', function ($scope, $filter, TagFactory, ResourceFactory, $state) {
  $scope.selectedTags = [];

  $scope.search = function () {
    var tags = $scope.selectedTags.map(function (tag) {
      return tag.id;
    });

    var tagTitles = $scope.selectedTags.map(function (tag) {
      return tag.title;
    });

    tagTitles = tagTitles.join('+');
    tags = tags.join('+');
    $state.go('searchResults', { tagIds: tags, tagTitles: tagTitles });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('home', {
    url: '/',
    templateUrl: 'js/home/home.html'
  });
});

app.config(function ($stateProvider) {
  $stateProvider.state('likedResources', {
    url: '/profile/:userId/liked',
    templateUrl: 'js/liked_resources/liked_resources.html',
    controller: 'LikedResourcesCtrl'
  });
});

app.controller('LikedResourcesCtrl', function ($scope, UserFactory, $stateParams, $log) {
  return UserFactory.getById($stateParams.userId).then(function (user) {
    $scope.user = user;
    $scope.data = user.resourceLike.slice(0, 5);
    $scope.guides = user.guideLike;
  }).then(function () {
    $scope.getMoreData = function () {
      $scope.data = $scope.user.resourceLike.slice(0, $scope.data.length + 5);
    };
  }).catch($log.error);
});

app.config(function ($stateProvider) {

  $stateProvider.state('login', {
    url: '/login',
    templateUrl: 'js/login/login.html',
    controller: 'LoginCtrl'
  });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {

  $scope.login = {};
  $scope.error = null;

  $scope.sendLogin = function (loginInfo) {

    $scope.error = null;

    AuthService.login(loginInfo).then(function () {
      $state.go('home');
    }).catch(function () {
      $scope.error = 'Invalid login credentials.';
    });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('newGuides', {
    url: '/newGuides',
    templateUrl: 'js/new_guides/new_guides.html',
    controller: 'newGuidesCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest', friend: [], resourceLike: [], resourceDislike: [], guideLike: [], guideDislike: [] };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('newGuidesCtrl', function ($scope, GuideFactory, UserFactory, AuthService, $log, user) {
  GuideFactory.getAll().then(function (guides) {
    $scope.guides = guides.sort(function (a, b) {
      var dateA = new Date(a.createdAt);
      dateA = Number(dateA);
      var dateB = new Date(b.createdAt);
      dateB = Number(dateB);
      return dateB - dateA;
    }).slice(0, 10);
  }).catch($log.error);

  $scope.user = user;
});

app.config(function ($stateProvider) {
  $stateProvider.state('newResources', {
    url: '/newResources',
    templateUrl: 'js/new_resources/new_resources.html',
    controller: 'newResourcesCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest' };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('newResourcesCtrl', function ($scope, AuthService, UserFactory, ResourceFactory, $log, user) {
  $scope.user = user;

  ResourceFactory.getAll().then(function (resources) {
    $scope.resources = resources.sort(function (a, b) {
      var dateA = new Date(a.createdAt);
      dateA = Number(dateA);
      var dateB = new Date(b.createdAt);
      dateB = Number(dateB);
      return dateB - dateA;
    }).slice(0, 10);
  }).catch($log.error);
});

app.config(function ($stateProvider) {
  $stateProvider.state('profile', {
    url: '/profile',
    controller: 'ProfileCtrl',
    templateUrl: 'js/profile/profile.html'
  });
});

app.controller('ProfileCtrl', function ($scope, $state, TagFactory, UserFactory, AuthService, $log, ResourceFactory, RecommendationFactory, GuideFactory) {
  $scope.loaded = false;
  $scope.selectedTags = [];
  $scope.user = {};

  function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  AuthService.getLoggedInUser().then(function (user) {
    return UserFactory.getById(user.id);
  }).then(function (fullUser) {
    $scope.user = fullUser; // gets current user
    $scope.selectedTags = fullUser.tags; // gets user's tags (topics user is interested in)
    $scope.friends = shuffleArray($scope.user.friend).slice(0, 4);
    return GuideFactory.getByAuthor($scope.user.id);
  }).then(function (guides) {
    $scope.guides = guides;
    $scope.noGuides = $scope.guides.length === 0;
    if ($scope.selectedTags.length) {
      return fetchResources($scope.selectedTags);
    } else {
      $scope.noTags = true;
    }
  }).then(function () {
    $scope.loaded = true;
    $scope.$watchCollection('selectedTags', function () {
      _.debounce(updatePage, 1000)();
    });
  }).catch($log.error);

  function updatePage() {
    updateTags().then(function (tags) {
      if ($scope.selectedTags.length) {
        $scope.noTags = false;
        return fetchResources(tags);
      } else {
        $scope.noTags = true;
        $scope.resources = [];
      }
    }).catch($log.error);
  }

  // profile page displays: recommended resources, guides created by the user, user's picture & account settings, & user's friends
  function fetchResources(updatedTags) {
    var tags = updatedTags.map(function (tag) {
      return +tag.id;
    });
    return ResourceFactory.getAllByTag(tags).then(function (resources) {
      $scope.resources = RecommendationFactory.get(resources, $scope.user).map(function (obj) {
        return obj.resource;
      }).slice(0, 5);
    }).then(function () {
      return UserFactory.getByTags(tags).then(function (users) {
        if (users.length > 0) {
          var suggestedFriends = [];
          $scope.userFriendsIds = $scope.user.friend.map(function (friend) {
            return +friend.id;
          });
          users.map(function (user) {
            if ($scope.userFriendsIds.indexOf(user.id) === -1 && $scope.user.id !== user.id) {
              suggestedFriends.push(user);
            }
          });
          $scope.suggestedFriends = shuffleArray(suggestedFriends).slice(0, 4);
        }
      });
    }).catch($log.error);
  }

  function updateTags() {
    var tags = $scope.selectedTags.map(function (tag) {
      if ((typeof tag === 'undefined' ? 'undefined' : _typeof(tag)) === 'object') return tag.title;else return tag;
    });
    return UserFactory.setTags($scope.user.id, tags).catch($log.error);
  }

  $scope.findFriend = function (friendId) {
    $state.go('friend', { friendId: friendId });
  };

  $scope.findFriends = function (userId) {
    $state.go('friends', { userId: userId });
  };

  $scope.viewLikedResources = function () {
    $state.go('likedResources', { userId: $scope.user.id });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('searchPeople', {
    url: '/search_people',
    templateUrl: 'js/search_people/search_people.html',
    controller: 'searchPeopleCtrl'
  });
});

app.controller('searchPeopleCtrl', function ($scope, $state, UserFactory, $log) {
  UserFactory.getAll().then(function (users) {
    $scope.users = users;
  }).catch($log.error);

  $scope.findFriend = function (userId) {
    $state.go('friend', { friendId: userId });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('searchResults', {
    url: '/search_results/tags/:tagIds/:tagTitles',
    templateUrl: 'js/search_results/search_results.html',
    controller: 'SearchCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest', friend: [], resourceLike: [], resourceDislike: [], guideLike: [], guideDislike: [] };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('SearchCtrl', function ($scope, $stateParams, ResourceFactory, GuideFactory, user, $log) {
  $scope.tags = $stateParams.tagTitles.split('+');
  var tags = $stateParams.tagIds.split('+');
  tags = tags.map(function (id) {
    return +id;
  });
  $scope.user = user;
  ResourceFactory.getAllByTag(tags).then(function (resources) {
    $scope.resources = resources.sort(function (a, b) {
      if (a.netLikes > b.netLikes) {
        return -1;
      }
      if (a.netLikes < b.netLikes) {
        return 1;
      }
      return 0;
    });
    $scope.data = $scope.resources.slice(0, 5);
  }).then(function () {
    $scope.getMoreData = function () {
      $scope.data = $scope.resources.slice(0, $scope.data.length + 5);
    };
  }).catch($log.error);

  GuideFactory.getAllByTag(tags).then(function (guides) {
    $scope.guides = guides;
  }).catch($log.error);

  $scope.userGuides = user.guides;
});

app.config(function ($stateProvider) {

  $stateProvider.state('signup', {
    url: '/signup',
    templateUrl: 'js/signup/signup.html',
    controller: 'SignupCtrl'
  });
});

app.controller('SignupCtrl', function ($log, $scope, AuthService, $state, TagFactory) {

  $scope.checkInfo = {};
  $scope.error = null;
  $scope.user = {};

  $scope.sendSignUp = function (signUpInfo) {
    $scope.error = null;

    if ($scope.user.password !== $scope.user.passwordConfirm) {
      $scope.error = 'Passwords do not match, please re-enter password.';
    } else {
      AuthService.signup(signUpInfo).then(function () {
        $state.go('home');
      }).catch(function () {
        $scope.error = 'Invalid login credentials.';
      });
    }
  };

  TagFactory.getAll().then(function (tags) {
    var allTags = tags;

    $scope.allTags = allTags;
    $scope.user.tags = [];

    $scope.queryTags = function (search) {
      var firstPass = allTags.filter(function (tag) {
        return tag.title.includes(search.toLowerCase());
      });
      return firstPass.filter(function (tag) {
        for (var i = 0; i < $scope.user.tags.length; i++) {
          if (tag.title === search) return false;
        }
        return true;
      });
    };

    $scope.addTag = function (group) {
      $scope.user.tags.push(group);
    };

    $scope.$watchCollection('user.tags', function () {
      $scope.availableTags = $scope.queryTags('');
    });
  }).catch($log.error);
});

app.factory('DataFactory', function () {
  var DataFactory = {};

  DataFactory.getData = function (response) {
    return response.data;
  };
  return DataFactory;
});

app.factory('GuideFactory', function ($http, DataFactory) {
  var GuideFactory = {};

  GuideFactory.getAll = function () {
    return $http.get('/api/guides').then(DataFactory.getData);
  };
  GuideFactory.getAllByTag = function () {
    var tagIds = [].concat(Array.prototype.slice.call(arguments));
    tagIds = tagIds.join(',');
    // 'api/guides?tagIds=1,2,3'
    return $http.get('/api/guides?tagIds=' + tagIds).then(DataFactory.getData);
  };
  GuideFactory.getByAuthor = function (authorId) {
    return $http.get('/api/guides?authorId=' + authorId).then(DataFactory.getData);
  };
  GuideFactory.getById = function (id) {
    return $http.get('/api/guides/' + id).then(DataFactory.getData);
  };
  GuideFactory.addNewGuide = function (data) {
    return $http.post('/api/guides', data).then(DataFactory.getData);
  };
  GuideFactory.addResource = function (id, data) {
    return $http.put('/api/guides/' + id + '/add', data);
  };
  GuideFactory.removeResource = function (id, data) {
    return $http.put('/api/guides/' + id + '/delete', data);
  };
  GuideFactory.like = function (id) {
    return $http.put('/api/guides/' + id + '/like');
  };
  GuideFactory.dislike = function (id) {
    return $http.put('/api/guides/' + id + '/dislike');
  };
  GuideFactory.delete = function (id) {
    return $http.delete('/api/guides/' + id + '/deleteguide');
  };

  GuideFactory.updateOrder = function (id, data) {
    return $http.put('/api/guides/' + id + '/order', data);
  };
  GuideFactory.removeLike = function (id, userId) {
    return $http.delete('/api/guides/' + id + '/like/users/' + userId);
  };
  GuideFactory.removeDislike = function (id, userId) {
    return $http.delete('/api/guides/' + id + '/dislike/users/' + userId);
  };
  return GuideFactory;
});

app.factory('RecommendationFactory', function () {
  var RecommendationFactory = {};

  var intersect = function intersect(a, b) {
    var ai = 0,
        bi = 0;
    var result = [];

    while (ai < a.length && bi < b.length) {
      if (a[ai] < b[bi]) {
        ai++;
      } else if (a[ai] > b[bi]) {
        bi++;
      } else {
        /* they're equal */
        result.push(a[ai]);
        ai++;
        bi++;
      }
    }
    return result;
  };
  var compare = function compare(a, b) {
    if (a.rating < b.rating) return 1;
    if (a.rating > b.rating) return -1;
    return 0;
  };

  function shuffle(array) {
    var copy = [],
        n = array.length,
        i;
    // While there remain elements to shuffle…
    while (n) {
      // Pick a remaining element…
      i = Math.floor(Math.random() * array.length);

      // If not already shuffled, move it to the new array.
      if (i in array) {
        copy.push(array[i]);
        delete array[i];
        n--;
      }
    }
    return copy;
  }

  RecommendationFactory.get = function (resources, currentUser) {
    var recommended = [];
    var shuffleGroup = [];

    resources.forEach(function (resource) {
      //Formula for calculating how many friends like each resource.
      var currentRating = intersect(currentUser.friend, resource.likeUser).length - intersect(currentUser.friend, resource.dislikeUser).length;
      if (currentRating >= 0 && resource.dislikeUser.indexOf(currentUser.id) === -1 && resource.likeUser.indexOf(currentUser.id) === -1) {
        var obj = { resource: resource, rating: currentRating };
        if (currentRating === 0) shuffleGroup.push(obj);else recommended.push(obj);
      }
    });
    shuffleGroup = shuffle(shuffleGroup);
    recommended = recommended.concat(shuffleGroup);
    //Uses array.sort to sort the recommended resources numerically by rating
    return recommended.sort(compare);
  };
  return RecommendationFactory;
});

app.factory('ResourceFactory', function ($http, DataFactory) {
  var ResourceFactory = {};

  ResourceFactory.getAll = function () {
    return $http.get('/api/resources').then(DataFactory.getData);
  };
  ResourceFactory.getAllByTag = function () {
    var tagIds = [].concat(Array.prototype.slice.call(arguments));
    tagIds = tagIds.join(',');
    //  '/api/resources?tagIds=1,2,3,'
    return $http.get('/api/resources?tagIds=' + tagIds).then(DataFactory.getData);
  };

  ResourceFactory.getAllByType = function (type) {
    return $http.get('/api/resources?type=' + type).then(DataFactory.getData);
  };

  ResourceFactory.getAllByAuthor = function (author) {
    return $http.get('/api/resources?author=' + author).then(DataFactory.getData);
  };

  ResourceFactory.getAllBySource = function (source) {
    source = source.replace('+', '%2B');
    return $http.get('/api/resources?source=' + source).then(DataFactory.getData);
  };

  ResourceFactory.getById = function (id) {
    return $http.get('/api/resources/' + id).then(DataFactory.getData);
  };

  ResourceFactory.post = function (data) {
    return $http.post('/api/resources', data).then(DataFactory.getData);
  };

  ResourceFactory.like = function (id) {
    return $http.put('/api/resources/' + id + '/like');
  };

  ResourceFactory.dislike = function (id) {
    return $http.put('/api/resources/' + id + '/dislike');
  };

  ResourceFactory.removeLike = function (id, userId) {
    return $http.delete('/api/resources/' + id + '/like/users/' + userId);
  };

  ResourceFactory.removeDislike = function (id, userId) {
    return $http.delete('/api/resources/' + id + '/dislike/users/' + userId);
  };

  ResourceFactory.delete = function (id) {
    return $http.delete('api/resources/' + id);
  };
  return ResourceFactory;
});

app.factory('TagFactory', function ($http, DataFactory) {
  var TagFactory = {};

  TagFactory.getAll = function () {
    return $http.get('/api/tags').then(DataFactory.getData);
  };
  TagFactory.addTag = function (info) {
    return $http.post('/api/tags', info).then(DataFactory.getData);
  };

  TagFactory.getById = function (id) {
    return $http.get('/api/tags/' + id).then(DataFactory.getData);
  };
  return TagFactory;
});

app.factory('UserFactory', function ($http, DataFactory) {
  var UserFactory = {};

  UserFactory.getAll = function () {
    return $http.get('/api/users').then(DataFactory.getData);
  };

  UserFactory.getById = function (id) {
    return $http.get('/api/users/' + id).then(DataFactory.getData);
  };

  UserFactory.addUser = function (info) {
    return $http.post('/api/users', info).then(DataFactory.getData);
  };

  UserFactory.setTags = function (id, tags) {
    return $http.put('/api/users/' + id + '/settags', tags).then(DataFactory.getData);
  };

  UserFactory.getByTags = function () {
    var tagIds = [].concat(Array.prototype.slice.call(arguments));
    tagIds = tagIds.join(',');
    return $http.get('/api/users?tagIds=' + tagIds).then(DataFactory.getData);
  };

  UserFactory.addFriend = function (userId, friendId) {
    return $http.put('/api/users/' + userId + '/addFriend', friendId);
  };

  UserFactory.deleteFriend = function (userId, friendId) {
    return $http.delete('/api/users/' + userId + '/deleteFriend/' + friendId);
  };

  return UserFactory;
});

app.config(function ($stateProvider) {
  $stateProvider.state('searchAuthorResults', {
    url: '/search_results/author/:authorName',
    templateUrl: 'js/search_results/search_results.html',
    controller: 'SearchAuthorCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest', friend: [], resourceLike: [], resourceDislike: [], guideLike: [], guideDislike: [] };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('SearchAuthorCtrl', function ($scope, ResourceFactory, $log, user, $stateParams) {
  $scope.author = $stateParams.authorName;
  $scope.user = user;
  $scope.guides = [];
  ResourceFactory.getAllByAuthor($stateParams.authorName).then(function (resources) {
    $scope.resources = resources;
    $scope.data = $scope.resources.slice(0, 5);
  }).then(function () {
    $scope.getMoreData = function () {
      $scope.data = $scope.resources.slice(0, $scope.data.length + 5);
    };
  }).catch($log.error);
});

app.config(function ($stateProvider) {
  $stateProvider.state('searchSourceResults', {
    url: '/search_results/source/:source',
    templateUrl: 'js/search_results/search_results.html',
    controller: 'SearchSourceCtrl',
    resolve: {
      user: function user(AuthService, UserFactory) {
        return AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            return { id: 0, name: 'Guest', friend: [], resourceLike: [], resourceDislike: [], guideLike: [], guideDislike: [] };
          }
          return UserFactory.getById(user.id);
        });
      }
    }
  });
});

app.controller('SearchSourceCtrl', function ($scope, ResourceFactory, $log, user, $stateParams) {
  $scope.source = $stateParams.source;
  $scope.user = user;
  $scope.guides = [];
  ResourceFactory.getAllBySource($stateParams.source).then(function (resources) {
    $scope.resources = resources;
    $scope.data = $scope.resources.slice(0, 5);
  }).then(function () {
    $scope.getMoreData = function () {
      $scope.data = $scope.resources.slice(0, $scope.data.length + 5);
    };
  }).catch($log.error);
});

app.directive('addToGuide', function ($mdDialog, $mdToast, GuideFactory, $log, $rootScope) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/add-to-guide/add-to-guide.html',
    scope: {
      resource: '=',
      userGuides: '=',
      user: '='
    },
    link: function link(scope) {
      scope.guide = { tags: [] };
      scope.openPanel = false;

      scope.newGuide = false;
      scope.openToast = function () {
        $mdToast.show($mdToast.simple().textContent('Resource added to Guide!'));
      };

      scope.showAdvanced = function () {
        $mdDialog.show({
          scope: scope,
          preserveScope: true,
          templateUrl: 'js/common/directives/add-to-guide/dialog-template.html',
          clickOutsideToClose: true,
          escapeToClose: true
        });
      };

      scope.clearForm = function () {
        scope.guideForm.$setPristine();
        scope.guideForm.$setUntouched();
        scope.guide = { tags: [] };
      };

      scope.submitForm = function () {
        if (scope.guide.id) {
          return GuideFactory.addResource(scope.guide.id, scope.resource).then(function () {
            scope.clearForm();
            $mdDialog.hide();
            scope.openToast();
          });
        } else if (scope.guide.title) {
          return GuideFactory.addNewGuide({ title: scope.guide.title, author: scope.user, description: scope.guide.description, tags: scope.guide.tags }).then(function (guide) {
            return GuideFactory.addResource(guide.id, scope.resource);
          }).then(function () {
            $rootScope.$broadcast('new guide');
            scope.clearForm();
            $mdDialog.hide();
            scope.openToast();
          }).catch($log.error);
        }
      };
    }
  };
});

app.directive('fab', function ($mdDialog, AuthService, $log, UserFactory, $rootScope, AUTH_EVENTS, ResourceFactory, $mdToast, GuideFactory) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/fab/fab.html',
    scope: true,
    link: function link(scope) {
      scope.resource = { tags: [] };
      scope.types = ['article', 'book', 'blog', 'podcast', 'website'];

      scope.openToast = function (message) {
        $mdToast.show($mdToast.simple().textContent(message));
      };

      var getGuides = function getGuides() {
        AuthService.getLoggedInUser().then(function (user) {
          if (!user) {
            scope.loggedIn = false;
            return [];
          } else {
            scope.loggedIn = true;
            return UserFactory.getById(user.id);
          }
        }).then(function (fullUser) {
          scope.guides = fullUser.guides;
        }).catch($log.error);
      };

      var clearGuides = function clearGuides() {
        scope.guides = [];
        scope.loggedIn = false;
      };

      scope.showDialog = function () {
        $mdDialog.show({
          contentElement: '#resourceDialog',
          parent: angular.element(document.body),
          clickOutsideToClose: true,
          escapeToClose: true
        });
      };

      scope.clearForm = function () {
        scope.resourceForm.$setPristine();
        scope.resourceForm.$setUntouched();
        scope.resource = { tags: [] };
      };

      scope.submitForm = function () {
        var created;
        if (scope.resource.tags.length === 0) {
          scope.resourceForm.tags.$invalid = true;
        } else if (scope.resourceForm.$valid) {
          ResourceFactory.post(scope.resource).then(function (result) {
            created = result.created;
            if (scope.resource.guide) {
              var guideId = scope.resource.guide;
              return GuideFactory.addResource(guideId, result.data);
            } else return;
          }).then(function () {
            var message = created ? 'Resource created!' : 'Resource already exists!';
            if (scope.resource.guide) message += ' Added to guide.';
            scope.clearForm();
            $mdDialog.hide();
            scope.openToast(message);
          }).catch($log.error);
        }
      };

      getGuides();

      $rootScope.$on(AUTH_EVENTS.loginSuccess, getGuides);
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, clearGuides);
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, clearGuides);
      $rootScope.$on('new guide', getGuides);
    }
  };
});

app.directive('guideCard', function (GuideFactory, $state, $log) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/guide-card/guide-card.html',
    scope: true,
    link: function link(scope) {
      if (scope.user.id !== 0) {
        (function () {
          var liked = scope.user.guideLike.filter(function (item) {
            return item.id === scope.guide.id;
          }).length === 1;

          var disliked = scope.user.guideDislike.filter(function (item) {
            return item.id === scope.guide.id;
          }).length === 1;

          scope.like = function (id) {
            if (scope.user.guideLike.filter(function (guide) {
              return guide.id === id;
            }).length === 0 && !liked) {
              GuideFactory.like(id).then(function () {
                liked = true;
                scope.guide.likes += 1;

                if (disliked) {
                  disliked = false;
                  scope.guide.dislikes -= 1;
                  return GuideFactory.removeDislike(id, scope.user.id);
                }
              }).catch($log.error);
            }
          };

          scope.dislike = function (id) {
            if (scope.user.guideDislike.filter(function (guide) {
              return guide.id === id;
            }).length === 0 && !disliked) {
              GuideFactory.dislike(id).then(function () {
                disliked = true;
                scope.guide.dislikes += 1;

                if (liked) {
                  liked = false;
                  scope.guide.likes -= 1;
                  return GuideFactory.removeLike(id, scope.user.id);
                }
              }).catch($log.error);
            }
          };
        })();
      }

      scope.findFriend = function (friendId) {
        $state.go('friend', { friendId: friendId });
      };
    }
  };
});

app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/navbar/navbar.html',
    link: function link(scope) {

      scope.items = [{ label: 'New Resources', state: 'newResources' }, { label: 'New Guides', state: 'newGuides' }, { label: 'People', state: 'searchPeople' }];

      scope.user = null;

      scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
      };

      scope.logout = function () {
        AuthService.logout().then(function () {
          $state.go('home');
        });
      };

      var setUser = function setUser() {
        AuthService.getLoggedInUser().then(function (user) {
          scope.user = user;
        });
      };

      var removeUser = function removeUser() {
        scope.user = null;
      };

      setUser();

      $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
    }

  };
});

app.directive('resourceCard', function ($state, $log, ResourceFactory, GuideFactory) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/resource-card/resource-card.html',
    scope: true,
    link: function link(scope, element) {
      var liked = scope.user.resourceLike.filter(function (item) {
        return item.id === scope.resource.id;
      }).length === 1;

      var disliked = scope.user.resourceDislike.filter(function (item) {
        return item.id === scope.resource.id;
      }).length === 1;

      scope.like = function (id) {
        if (scope.user.resourceLike.filter(function (resource) {
          return resource.id === id;
        }).length === 0 && !liked) {
          ResourceFactory.like(id).then(function () {
            liked = true;
            scope.resource.likes += 1;
            if (disliked) {
              disliked = false;
              scope.resource.dislikes -= 1;
              return ResourceFactory.removeDislike(id, scope.user.id);
            }
          }).catch($log.error);
        }
      };

      scope.dislike = function (id) {
        if (scope.user.resourceDislike.filter(function (resource) {
          return resource.id === id;
        }).length === 0 && !disliked) {
          ResourceFactory.dislike(id).then(function () {
            disliked = true;
            scope.resource.dislikes += 1;
            if (liked) {
              liked = false;
              scope.resource.likes -= 1;
              return ResourceFactory.removeLike(id, scope.user.id);
            }
          }).catch($log.error);
        }
      };

      scope.userGuides = scope.user.guides;

      scope.searchByTag = function (id, title) {
        $state.go('searchResults', { tagIds: id, tagTitles: title });
      };

      scope.searchByAuthor = function (authorName) {
        $state.go('searchAuthorResults', { authorName: authorName });
      };

      scope.searchBySource = function (source) {
        $state.go('searchSourceResults', { source: source });
      };

      scope.delete = function (id) {
        if (scope.user.isAdmin) {
          ResourceFactory.delete(id).then(function () {
            element.html('');
          });
        }
      };

      scope.remove = function (id) {
        if (scope.user.id === scope.author.id) {
          GuideFactory.removeResource(scope.guide.id, { id: id }).then(function () {
            element.html('');
          });
        }
      };
    }
  };
});

app.directive('tagChips', function (TagFactory, ResourceFactory, $log) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/tag-chips/tag-chips.html',
    scope: {
      selectedTags: '=',
      match: '='
    },
    link: function link(scope) {

      TagFactory.getAll().then(function (tags) {
        var allTags = tags;
        scope.allTags = allTags;

        scope.queryTags = function (search) {
          var firstPass = allTags.filter(function (tag) {
            return tag.title.includes(search.toLowerCase());
          });

          return firstPass.filter(function (tag) {
            for (var i = 0; i < scope.selectedTags.length; i++) {
              if (tag.title === search) return false;
            }
            return true;
          });
        };

        scope.transformChip = function (chip) {
          if (angular.isObject(chip)) {
            return chip;
          } else if (chip) {
            return { title: chip.toLowerCase(), type: 'new' };
          }
        };

        scope.$watchCollection('selectedTags', function () {
          scope.availableTags = scope.queryTags('');
        });
      }).catch($log.error);
    }
  };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImZyaWVuZC9mcmllbmQuanMiLCJmcmllbmRzL2ZyaWVuZHMuanMiLCJmc2EvZnNhLXByZS1idWlsdC5qcyIsImd1aWRlX2RldGFpbC9ndWlkZS5qcyIsImhvbWUvaG9tZS5qcyIsImxpa2VkX3Jlc291cmNlcy9saWtlZF9yZXNvdXJjZXMuanMiLCJsb2dpbi9sb2dpbi5qcyIsIm5ld19ndWlkZXMvbmV3X2d1aWRlcy5qcyIsIm5ld19yZXNvdXJjZXMvbmV3X3Jlc291cmNlcy5qcyIsInByb2ZpbGUvcHJvZmlsZS5qcyIsInNlYXJjaF9wZW9wbGUvc2VhcmNoX3Blb3BsZS5qcyIsInNlYXJjaF9yZXN1bHRzL3NlYXJjaF9yZXN1bHRzLmpzIiwic2lnbnVwL3NpZ251cC5qcyIsImNvbW1vbi9mYWN0b3JpZXMvZGF0YV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9ndWlkZV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9yZWNvbW1lbmRhdGlvbl9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9yZXNvdXJjZV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy90YWdfZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvdXNlcl9mYWN0b3J5LmpzIiwic2VhcmNoX3Jlc3VsdHMvc2VhcmNoX2F1dGhvcl9yZXN1bHRzL3NlYXJjaF9hdXRob3JfcmVzdWx0cy5qcyIsInNlYXJjaF9yZXN1bHRzL3NlYXJjaF9zb3VyY2VfcmVzdWx0cy9zZWFyY2hfc291cmNlX3Jlc3VsdHMuanMiLCJjb21tb24vZGlyZWN0aXZlcy9hZGQtdG8tZ3VpZGUvYWRkLXRvLWd1aWRlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZmFiL2ZhYi5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2d1aWRlLWNhcmQvZ3VpZGUtY2FyZC5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJjb21tb24vZGlyZWN0aXZlcy9yZXNvdXJjZS1jYXJkL3Jlc291cmNlLWNhcmQuanMiLCJjb21tb24vZGlyZWN0aXZlcy90YWctY2hpcHMvdGFnLWNoaXBzLmpzIl0sIm5hbWVzIjpbIndpbmRvdyIsImFwcCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJURVNUSU5HIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwidGVtcGxhdGVVcmwiLCJjb250cm9sbGVyIiwiJHNjb3BlIiwiVXNlckZhY3RvcnkiLCIkc3RhdGVQYXJhbXMiLCJHdWlkZUZhY3RvcnkiLCIkbG9nIiwiZ2V0QnlJZCIsImZyaWVuZElkIiwiZnJpZW5kIiwiaWQiLCJyZXNvdXJjZUxpa2VzIiwicmVzb3VyY2VEaXNsaWtlcyIsImd1aWRlTGlrZXMiLCJndWlkZURpc2xpa2VzIiwiZm91bmRVc2VyIiwidXNlckZyaWVuZHMiLCJ1c2VyRnJpZW5kc0lkcyIsIm1hcCIsInVzZXJGcmllbmQiLCJsb2FkZWQiLCJjYXRjaCIsImdldEJ5QXV0aG9yIiwiZ3VpZGVzIiwiZm9sbG93IiwiYWRkRnJpZW5kIiwicHVzaCIsInNlYXJjaCIsInRhZ0lkIiwidGFnSWRzIiwidW5mb2xsb3ciLCJkZWxldGVGcmllbmQiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1c2VySWQiLCJmcmllbmRzIiwiZmluZEZyaWVuZCIsIkVycm9yIiwiZmFjdG9yeSIsImlvIiwib3JpZ2luIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiJHEiLCJBVVRIX0VWRU5UUyIsInN0YXR1c0RpY3QiLCJyZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCIkYnJvYWRjYXN0Iiwic3RhdHVzIiwicmVqZWN0IiwiJGh0dHBQcm92aWRlciIsImludGVyY2VwdG9ycyIsIiRpbmplY3RvciIsImdldCIsInNlcnZpY2UiLCIkaHR0cCIsIlNlc3Npb24iLCJvblN1Y2Nlc3NmdWxMb2dpbiIsImNyZWF0ZSIsImZyb21TZXJ2ZXIiLCJsb2dpbiIsImNyZWRlbnRpYWxzIiwicG9zdCIsIm1lc3NhZ2UiLCJsb2dvdXQiLCJkZXN0cm95Iiwic2lnbnVwIiwic2lnblVwSW5mbyIsInNlbGYiLCJyZXNvbHZlIiwicmVzb3VyY2VMaWtlIiwicmVzb3VyY2VEaXNsaWtlIiwiZ3VpZGVMaWtlIiwiZ3VpZGVEaXNsaWtlIiwiJG1kVG9hc3QiLCJndWlkZSIsImF1dGhvciIsInJlc291cmNlcyIsInNvcnQiLCJhIiwiYiIsIm9yZGVyIiwiZGVsZXRlR3VpZGUiLCJkZWxldGUiLCJzb3J0YWJsZU9wdGlvbnMiLCJ1cGRhdGVPcmRlciIsIm5ld09yZGVyIiwicmVzb3VyY2UiLCJzaG93Iiwic2ltcGxlIiwidGV4dENvbnRlbnQiLCIkZmlsdGVyIiwiVGFnRmFjdG9yeSIsIlJlc291cmNlRmFjdG9yeSIsInNlbGVjdGVkVGFncyIsInRhZ3MiLCJ0YWciLCJ0YWdUaXRsZXMiLCJ0aXRsZSIsImpvaW4iLCJzbGljZSIsImdldE1vcmVEYXRhIiwibGVuZ3RoIiwic2VuZExvZ2luIiwibG9naW5JbmZvIiwiZ2V0QWxsIiwiZGF0ZUEiLCJEYXRlIiwiY3JlYXRlZEF0IiwiTnVtYmVyIiwiZGF0ZUIiLCJSZWNvbW1lbmRhdGlvbkZhY3RvcnkiLCJzaHVmZmxlQXJyYXkiLCJhcnJheSIsImkiLCJqIiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwidGVtcCIsImZ1bGxVc2VyIiwibm9HdWlkZXMiLCJmZXRjaFJlc291cmNlcyIsIm5vVGFncyIsIiR3YXRjaENvbGxlY3Rpb24iLCJfIiwiZGVib3VuY2UiLCJ1cGRhdGVQYWdlIiwidXBkYXRlVGFncyIsInVwZGF0ZWRUYWdzIiwiZ2V0QWxsQnlUYWciLCJvYmoiLCJnZXRCeVRhZ3MiLCJ1c2VycyIsInN1Z2dlc3RlZEZyaWVuZHMiLCJzZXRUYWdzIiwiZmluZEZyaWVuZHMiLCJ2aWV3TGlrZWRSZXNvdXJjZXMiLCJzcGxpdCIsIm5ldExpa2VzIiwidXNlckd1aWRlcyIsImNoZWNrSW5mbyIsInNlbmRTaWduVXAiLCJwYXNzd29yZCIsInBhc3N3b3JkQ29uZmlybSIsImFsbFRhZ3MiLCJxdWVyeVRhZ3MiLCJmaXJzdFBhc3MiLCJmaWx0ZXIiLCJpbmNsdWRlcyIsInRvTG93ZXJDYXNlIiwiYWRkVGFnIiwiZ3JvdXAiLCJhdmFpbGFibGVUYWdzIiwiRGF0YUZhY3RvcnkiLCJnZXREYXRhIiwiYXJndW1lbnRzIiwiYXV0aG9ySWQiLCJhZGROZXdHdWlkZSIsImFkZFJlc291cmNlIiwicHV0IiwicmVtb3ZlUmVzb3VyY2UiLCJsaWtlIiwiZGlzbGlrZSIsInJlbW92ZUxpa2UiLCJyZW1vdmVEaXNsaWtlIiwiaW50ZXJzZWN0IiwiYWkiLCJiaSIsInJlc3VsdCIsImNvbXBhcmUiLCJyYXRpbmciLCJzaHVmZmxlIiwiY29weSIsIm4iLCJjdXJyZW50VXNlciIsInJlY29tbWVuZGVkIiwic2h1ZmZsZUdyb3VwIiwiZm9yRWFjaCIsImN1cnJlbnRSYXRpbmciLCJsaWtlVXNlciIsImRpc2xpa2VVc2VyIiwiY29uY2F0IiwiZ2V0QWxsQnlUeXBlIiwidHlwZSIsImdldEFsbEJ5QXV0aG9yIiwiZ2V0QWxsQnlTb3VyY2UiLCJzb3VyY2UiLCJyZXBsYWNlIiwiYWRkVXNlciIsImF1dGhvck5hbWUiLCJkaXJlY3RpdmUiLCIkbWREaWFsb2ciLCJyZXN0cmljdCIsInNjb3BlIiwibGluayIsIm9wZW5QYW5lbCIsIm5ld0d1aWRlIiwib3BlblRvYXN0Iiwic2hvd0FkdmFuY2VkIiwicHJlc2VydmVTY29wZSIsImNsaWNrT3V0c2lkZVRvQ2xvc2UiLCJlc2NhcGVUb0Nsb3NlIiwiY2xlYXJGb3JtIiwiZ3VpZGVGb3JtIiwiJHNldFByaXN0aW5lIiwiJHNldFVudG91Y2hlZCIsInN1Ym1pdEZvcm0iLCJoaWRlIiwiZGVzY3JpcHRpb24iLCJ0eXBlcyIsImdldEd1aWRlcyIsImxvZ2dlZEluIiwiY2xlYXJHdWlkZXMiLCJzaG93RGlhbG9nIiwiY29udGVudEVsZW1lbnQiLCJwYXJlbnQiLCJlbGVtZW50IiwiZG9jdW1lbnQiLCJib2R5IiwicmVzb3VyY2VGb3JtIiwiY3JlYXRlZCIsIiRpbnZhbGlkIiwiJHZhbGlkIiwiZ3VpZGVJZCIsImxpa2VkIiwiaXRlbSIsImRpc2xpa2VkIiwibGlrZXMiLCJkaXNsaWtlcyIsIml0ZW1zIiwibGFiZWwiLCJpc0xvZ2dlZEluIiwic2V0VXNlciIsInJlbW92ZVVzZXIiLCJzZWFyY2hCeVRhZyIsInNlYXJjaEJ5QXV0aG9yIiwic2VhcmNoQnlTb3VyY2UiLCJpc0FkbWluIiwiaHRtbCIsInJlbW92ZSIsIm1hdGNoIiwidHJhbnNmb3JtQ2hpcCIsImNoaXAiLCJpc09iamVjdCJdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUFDQUEsT0FBQUMsR0FBQSxHQUFBQyxRQUFBQyxNQUFBLENBQUEsdUJBQUEsRUFBQSxDQUFBLGFBQUEsRUFBQSxXQUFBLEVBQUEsY0FBQSxFQUFBLFdBQUEsRUFBQSxZQUFBLEVBQUEsaUJBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQTs7QUFFQSxJQUFBLENBQUFILE9BQUFJLE9BQUEsRUFBQTtBQUNBO0FBQ0FILE1BQUFJLE1BQUEsQ0FBQSxVQUFBQyxrQkFBQSxFQUFBQyxp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QUFILFVBQUFDLE1BQUEsQ0FBQSxVQUFBcEQsR0FBQSxFQUFBO0FBQ0EsaUJBQUEsSUFBQWtCLElBQUEsQ0FBQSxFQUFBQSxJQUFBZ0YsTUFBQXBHLFlBQUEsQ0FBQVEsTUFBQSxFQUFBWSxHQUFBLEVBQUE7QUFDQSxrQkFBQWxCLElBQUFFLEtBQUEsS0FBQTlFLE1BQUEsRUFBQSxPQUFBLEtBQUE7QUFDQTtBQUNBLG1CQUFBLElBQUE7QUFDQSxXQUxBLENBQUE7QUFNQSxTQVhBOztBQWFBOEssY0FBQWdELGFBQUEsR0FBQSxVQUFBQyxJQUFBLEVBQUE7QUFDQSxjQUFBaFMsUUFBQWlTLFFBQUEsQ0FBQUQsSUFBQSxDQUFBLEVBQUE7QUFDQSxtQkFBQUEsSUFBQTtBQUNBLFdBRkEsTUFHQSxJQUFBQSxJQUFBLEVBQUE7QUFDQSxtQkFBQSxFQUFBakosT0FBQWlKLEtBQUE3RixXQUFBLEVBQUEsRUFBQWtDLE1BQUEsS0FBQSxFQUFBO0FBQ0E7QUFDQSxTQVBBOztBQVNBVSxjQUFBdEUsZ0JBQUEsQ0FBQSxjQUFBLEVBQUEsWUFBQTtBQUNBc0UsZ0JBQUF6QyxhQUFBLEdBQUF5QyxNQUFBaEQsU0FBQSxDQUFBLEVBQUEsQ0FBQTtBQUNBLFNBRkE7QUFHQSxPQTlCQSxFQStCQXBJLEtBL0JBLENBK0JBZixLQUFBckIsS0EvQkE7QUFpQ0E7QUExQ0EsR0FBQTtBQTRDQSxDQTdDQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdGdWxsc3RhY2tHZW5lcmF0ZWRBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJywgJ25nTWF0ZXJpYWwnLCAnaW5maW5pdGUtc2Nyb2xsJywgJ3VpLnNvcnRhYmxlJ10pO1xuXG5pZiAoIXdpbmRvdy5URVNUSU5HKSB7XG4gICAgLy8gV2h5IHdlIGRvbid0IHdhbnQgdGhpcyBibG9jayB0byBydW4gaWYgd2UncmUgaW4gdGhlIHRlc3RpbmcgbW9kZTogdGhpcyBibG9jayBtYWtlcyByZS1yb3V0ZXMgdGhlIHBhZ2UgdG8gaG9tZSBwYWdlICgkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvJykpOyB0aGlzIGFkZGl0aW9uYWwgcmVxdWVzdCBkb2Vzbid0IGdldCBoYW5kbGVkIGluIHRoZSBmcm9udC1lbmQgdGVzdGluZyBmaWxlcy0tdGhlIGZyb250LWVuZCB0ZXN0cyB3aWxsIHRoaW5rIHRoYXQgdGhleSBmYWlsZWRcbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAgICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgICAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAgICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpO1xuICAgICAgICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAgICAgICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgbGlzdGVuaW5nIHRvIGVycm9ycyBicm9hZGNhc3RlZCBieSB1aS1yb3V0ZXIsIHVzdWFsbHkgb3JpZ2luYXRpbmcgZnJvbSByZXNvbHZlc1xuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSkge1xuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VFcnJvcicsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMsIGZyb21TdGF0ZSwgZnJvbVBhcmFtcywgdGhyb3duRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBUaGUgZm9sbG93aW5nIGVycm9yIHdhcyB0aHJvd24gYnkgdWktcm91dGVyIHdoaWxlIHRyYW5zaXRpb25pbmcgdG8gc3RhdGUgXCIke3RvU3RhdGUubmFtZX1cIi4gVGhlIG9yaWdpbiBvZiB0aGlzIGVycm9yIGlzIHByb2JhYmx5IGEgcmVzb2x2ZSBmdW5jdGlvbjpgKTtcbiAgICAgICAgY29uc29sZS5lcnJvcih0aHJvd25FcnJvcik7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2ZyaWVuZCcsIHtcbiAgICAgIHVybDogJy9mcmllbmRzLzpmcmllbmRJZCcsXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL2ZyaWVuZC9mcmllbmQuaHRtbCcsXG4gICAgICBjb250cm9sbGVyOiAnZnJpZW5kQ3RybCdcbiAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ2ZyaWVuZEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUsIFVzZXJGYWN0b3J5LCAkc3RhdGVQYXJhbXMsIEd1aWRlRmFjdG9yeSwgQXV0aFNlcnZpY2UsICRsb2cpIHtcbiAgVXNlckZhY3RvcnkuZ2V0QnlJZCgkc3RhdGVQYXJhbXMuZnJpZW5kSWQpXG4gIC50aGVuKGZ1bmN0aW9uKGZyaWVuZCl7XG4gICAgJHNjb3BlLmZyaWVuZCA9IGZyaWVuZDtcbiAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCk7XG4gIH0pXG4gIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgIGlmICghdXNlcil7XG4gICAgICAkc2NvcGUudXNlciA9IHtpZDogMCwgbmFtZTogJ0d1ZXN0JywgZnJpZW5kOiBbXSwgcmVzb3VyY2VMaWtlczogW10sIHJlc291cmNlRGlzbGlrZXM6IFtdLCBndWlkZUxpa2VzOiBbXSwgZ3VpZGVEaXNsaWtlczogW119XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5SWQodXNlci5pZClcbiAgICAgIC50aGVuKGZ1bmN0aW9uKGZvdW5kVXNlcil7XG4gICAgICAgICRzY29wZS51c2VyID0gZm91bmRVc2VyO1xuICAgICAgICAkc2NvcGUudXNlckZyaWVuZHMgPSBmb3VuZFVzZXIuZnJpZW5kXG4gICAgICAgICRzY29wZS51c2VyRnJpZW5kc0lkcyA9ICRzY29wZS51c2VyRnJpZW5kcy5tYXAoZnVuY3Rpb24odXNlckZyaWVuZCkge1xuICAgICAgICAgIHJldHVybiB1c2VyRnJpZW5kLmlkO1xuICAgICAgICB9KVxuICAgICAgICAkc2NvcGUubG9hZGVkID0gdHJ1ZTtcbiAgICAgIH0pXG4gICAgfVxuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG5cbiAgR3VpZGVGYWN0b3J5LmdldEJ5QXV0aG9yKCRzdGF0ZVBhcmFtcy5mcmllbmRJZClcbiAgLnRoZW4oZnVuY3Rpb24oZ3VpZGVzKXtcbiAgICAkc2NvcGUuZ3VpZGVzID0gZ3VpZGVzXG4gIH0pXG4gIC5jYXRjaCgkbG9nLmVycm9yKVxuXG4gICRzY29wZS5mb2xsb3cgPSBmdW5jdGlvbihmcmllbmRJZCkge1xuICAgIHJldHVybiBVc2VyRmFjdG9yeS5hZGRGcmllbmQoJHNjb3BlLnVzZXIuaWQsIHtmcmllbmRJZDogZnJpZW5kSWR9KVxuICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgJHNjb3BlLnVzZXJGcmllbmRzSWRzLnB1c2goZnJpZW5kSWQpO1xuICAgIH0pXG4gICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICB9O1xuXG4gICRzY29wZS5zZWFyY2ggPSBmdW5jdGlvbih0YWdJZCkge1xuICAgICRzdGF0ZS5nbygnc2VhcmNoUmVzdWx0cycsIHt0YWdJZHM6IHRhZ0lkfSk7XG4gIH07XG5cbiAgJHNjb3BlLnVuZm9sbG93ID0gZnVuY3Rpb24oZnJpZW5kSWQpIHtcbiAgICByZXR1cm4gVXNlckZhY3RvcnkuZGVsZXRlRnJpZW5kKCRzY29wZS51c2VyLmlkLCBmcmllbmRJZClcbiAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbmRleCA9ICRzY29wZS51c2VyRnJpZW5kc0lkcy5pbmRleE9mKGZyaWVuZElkKTtcbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICRzY29wZS51c2VyRnJpZW5kc0lkcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH0pXG4gICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICB9O1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnZnJpZW5kcycsIHtcbiAgICAgIHVybDogJy86dXNlcklkL2ZyaWVuZHMvYWxsJyxcbiAgICAgIHRlbXBsYXRlVXJsOiAnanMvZnJpZW5kcy9mcmllbmRzLmh0bWwnLFxuICAgICAgY29udHJvbGxlcjogJ2ZyaWVuZHNDdHJsJ1xuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignZnJpZW5kc0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRzdGF0ZSwgVXNlckZhY3RvcnksICRzdGF0ZVBhcmFtcywgJGxvZykge1xuICBVc2VyRmFjdG9yeS5nZXRCeUlkKCRzdGF0ZVBhcmFtcy51c2VySWQpXG4gIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICRzY29wZS51c2VyID0gdXNlcjtcbiAgICAkc2NvcGUuZnJpZW5kcyA9IHVzZXIuZnJpZW5kO1xuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gIFxuICAkc2NvcGUuZmluZEZyaWVuZCA9IGZ1bmN0aW9uKGZyaWVuZElkKSB7XG4gICAgJHN0YXRlLmdvKCdmcmllbmQnLCB7ZnJpZW5kSWQ6IGZyaWVuZElkfSk7XG4gIH07XG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSkge1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uU3VjY2Vzc2Z1bExvZ2luKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgdXNlciA9IHJlc3BvbnNlLmRhdGEudXNlcjtcbiAgICAgICAgICAgIFNlc3Npb24uY3JlYXRlKHVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICByZXR1cm4gdXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9naW4gPSBmdW5jdGlvbiAoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvbG9naW4nLCBjcmVkZW50aWFscylcbiAgICAgICAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHsgbWVzc2FnZTogJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnNpZ251cCA9IGZ1bmN0aW9uKHNpZ25VcEluZm8pe1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9zaWdudXAnLCBzaWduVXBJbmZvKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBzaWdudXAgY3JlZGVudGlhbHMuJyB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KCkpO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnZ3VpZGVEZXRhaWwnLCB7XG4gICAgdXJsOiAnL2d1aWRlLzppZCcsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9ndWlkZV9kZXRhaWwvZ3VpZGUuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ0d1aWRlQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgdXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UsIFVzZXJGYWN0b3J5KXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgIGlmICghdXNlcil7XG4gICAgICAgICAgICByZXR1cm4ge2lkOiAwLCBuYW1lOiAnR3Vlc3QnLCBmcmllbmQ6IFtdLCByZXNvdXJjZUxpa2U6IFtdLCByZXNvdXJjZURpc2xpa2U6IFtdLCBndWlkZUxpa2U6IFtdLCBndWlkZURpc2xpa2U6IFtdfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSlcbn0pO1xuXG5hcHAuY29udHJvbGxlcignR3VpZGVDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgR3VpZGVGYWN0b3J5LCAkbG9nLCAkbWRUb2FzdCwgJHN0YXRlLCB1c2VyLCAkc3RhdGVQYXJhbXMpIHtcbiAgJHNjb3BlLnVzZXIgPSB1c2VyO1xuICBHdWlkZUZhY3RvcnkuZ2V0QnlJZCgkc3RhdGVQYXJhbXMuaWQpXG4gIC50aGVuKGZ1bmN0aW9uKGd1aWRlKXtcbiAgICAkc2NvcGUuZ3VpZGUgPSBndWlkZTtcbiAgICAkc2NvcGUuYXV0aG9yID0gZ3VpZGUuYXV0aG9yXG4gICAgJHNjb3BlLnJlc291cmNlcyA9IGd1aWRlLnJlc291cmNlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuICAgICAgaWYgKGIub3JkZXIgPiBhLm9yZGVyKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICBpZiAoYS5vcmRlciA+IGIub3JkZXIpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcbiAgfSlcbiAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuXG4gICRzY29wZS5kZWxldGVHdWlkZSA9IGZ1bmN0aW9uKGlkKXtcbiAgICByZXR1cm4gR3VpZGVGYWN0b3J5LmRlbGV0ZShpZClcbiAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgJHN0YXRlLmdvKCdwcm9maWxlJyk7XG4gICAgfSlcbiAgfVxuICAkc2NvcGUuc29ydGFibGVPcHRpb25zID0ge307XG5cbiAgJHNjb3BlLnVwZGF0ZU9yZGVyID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgbmV3T3JkZXIgPSAkc2NvcGUucmVzb3VyY2VzLm1hcChmdW5jdGlvbihyZXNvdXJjZSl7XG4gICAgICAgIHJldHVybiByZXNvdXJjZS5pZDtcbiAgICB9KTtcbiAgICBHdWlkZUZhY3RvcnkudXBkYXRlT3JkZXIoJHNjb3BlLmd1aWRlLmlkLCBuZXdPcmRlcilcbiAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgJG1kVG9hc3Quc2hvdygkbWRUb2FzdC5zaW1wbGUoKVxuICAgICAgICAgICAgICAgICAgICAudGV4dENvbnRlbnQoJ0d1aWRlIHVwZGF0ZWQhJykpO1xuICAgIH0pXG4gICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICB9O1xufSk7XG4iLCJhcHAuY29udHJvbGxlcignSG9tZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRmaWx0ZXIsIFRhZ0ZhY3RvcnksIFJlc291cmNlRmFjdG9yeSwgJHN0YXRlKSB7XG4gICRzY29wZS5zZWxlY3RlZFRhZ3MgPSBbXTtcblxuICAkc2NvcGUuc2VhcmNoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRhZ3MgPSAkc2NvcGUuc2VsZWN0ZWRUYWdzLm1hcChmdW5jdGlvbih0YWcpIHtcbiAgICAgIHJldHVybiB0YWcuaWQ7XG4gICAgfSk7XG5cbiAgICB2YXIgdGFnVGl0bGVzID0gJHNjb3BlLnNlbGVjdGVkVGFncy5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICByZXR1cm4gdGFnLnRpdGxlO1xuICAgIH0pO1xuXG4gICAgdGFnVGl0bGVzID0gdGFnVGl0bGVzLmpvaW4oJysnKTtcbiAgICB0YWdzID0gdGFncy5qb2luKCcrJyk7XG4gICAgJHN0YXRlLmdvKCdzZWFyY2hSZXN1bHRzJywge3RhZ0lkczogdGFncywgdGFnVGl0bGVzOiB0YWdUaXRsZXN9KTtcbiAgfTtcbn0pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9ob21lL2hvbWUuaHRtbCdcbiAgICB9KTtcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsaWtlZFJlc291cmNlcycsIHtcbiAgICAgIHVybDogJy9wcm9maWxlLzp1c2VySWQvbGlrZWQnLFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy9saWtlZF9yZXNvdXJjZXMvbGlrZWRfcmVzb3VyY2VzLmh0bWwnLFxuICAgICAgY29udHJvbGxlcjogJ0xpa2VkUmVzb3VyY2VzQ3RybCdcbiAgICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignTGlrZWRSZXNvdXJjZXNDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBVc2VyRmFjdG9yeSwgJHN0YXRlUGFyYW1zLCAkbG9nKSB7XG4gIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKCRzdGF0ZVBhcmFtcy51c2VySWQpXG4gIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICRzY29wZS51c2VyID0gdXNlcjtcbiAgICAkc2NvcGUuZGF0YSA9IHVzZXIucmVzb3VyY2VMaWtlLnNsaWNlKDAsNSk7XG4gICAgJHNjb3BlLmd1aWRlcyA9IHVzZXIuZ3VpZGVMaWtlO1xuICB9KVxuICAudGhlbihmdW5jdGlvbigpe1xuICAgICRzY29wZS5nZXRNb3JlRGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICRzY29wZS5kYXRhID0gJHNjb3BlLnVzZXIucmVzb3VyY2VMaWtlLnNsaWNlKDAsICRzY29wZS5kYXRhLmxlbmd0aCArIDUpXG4gICAgfVxuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLic7XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCduZXdHdWlkZXMnLCB7XG4gICAgdXJsOiAnL25ld0d1aWRlcycsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9uZXdfZ3VpZGVzL25ld19ndWlkZXMuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ25ld0d1aWRlc0N0cmwnLFxuICAgIHJlc29sdmU6e1xuICAgICAgdXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UsIFVzZXJGYWN0b3J5KXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgIGlmICghdXNlcil7XG4gICAgICAgICAgICByZXR1cm4ge2lkOiAwLCBuYW1lOiAnR3Vlc3QnLCBmcmllbmQ6IFtdLCByZXNvdXJjZUxpa2U6IFtdLCByZXNvdXJjZURpc2xpa2U6IFtdLCBndWlkZUxpa2U6IFtdLCBndWlkZURpc2xpa2U6IFtdfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCduZXdHdWlkZXNDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBHdWlkZUZhY3RvcnksIFVzZXJGYWN0b3J5LCBBdXRoU2VydmljZSwgJGxvZywgdXNlcikge1xuICBHdWlkZUZhY3RvcnkuZ2V0QWxsKClcbiAgLnRoZW4oZnVuY3Rpb24oZ3VpZGVzKXtcbiAgICAkc2NvcGUuZ3VpZGVzID0gZ3VpZGVzLnNvcnQoZnVuY3Rpb24oYSwgYil7XG4gICAgICBsZXQgZGF0ZUEgPSBuZXcgRGF0ZShhLmNyZWF0ZWRBdCk7XG4gICAgICBkYXRlQSA9IE51bWJlcihkYXRlQSk7XG4gICAgICBsZXQgZGF0ZUIgPSBuZXcgRGF0ZShiLmNyZWF0ZWRBdCk7XG4gICAgICBkYXRlQiA9IE51bWJlcihkYXRlQik7XG4gICAgICByZXR1cm4gZGF0ZUIgLSBkYXRlQTtcbiAgICB9KS5zbGljZSgwLDEwKTtcbiAgfSlcbiAgLmNhdGNoKCRsb2cuZXJyb3IpXG5cbiAgJHNjb3BlLnVzZXIgPSB1c2VyO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCduZXdSZXNvdXJjZXMnLCB7XG4gICAgdXJsOiAnL25ld1Jlc291cmNlcycsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9uZXdfcmVzb3VyY2VzL25ld19yZXNvdXJjZXMuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ25ld1Jlc291cmNlc0N0cmwnLFxuICAgIHJlc29sdmU6IHtcbiAgICB1c2VyOiBmdW5jdGlvbihBdXRoU2VydmljZSwgVXNlckZhY3Rvcnkpe1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgICAgaWYgKCF1c2VyKXtcbiAgICAgICAgICAgIHJldHVybiB7aWQ6IDAsIG5hbWU6ICdHdWVzdCd9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ25ld1Jlc291cmNlc0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlLCBVc2VyRmFjdG9yeSwgUmVzb3VyY2VGYWN0b3J5LCAkbG9nLCB1c2VyKSB7XG4gICRzY29wZS51c2VyID0gdXNlcjtcblxuICBSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsKClcbiAgLnRoZW4oZnVuY3Rpb24ocmVzb3VyY2VzKXtcbiAgICAkc2NvcGUucmVzb3VyY2VzID0gcmVzb3VyY2VzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgdmFyIGRhdGVBID0gbmV3IERhdGUoYS5jcmVhdGVkQXQpO1xuICAgICAgZGF0ZUEgPSBOdW1iZXIoZGF0ZUEpO1xuICAgICAgdmFyIGRhdGVCID0gbmV3IERhdGUoYi5jcmVhdGVkQXQpO1xuICAgICAgZGF0ZUIgPSBOdW1iZXIoZGF0ZUIpO1xuICAgICAgcmV0dXJuIGRhdGVCIC0gZGF0ZUE7XG4gICAgfSkuc2xpY2UoMCwgMTApO1xuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdwcm9maWxlJywge1xuICAgICAgdXJsOiAnL3Byb2ZpbGUnLFxuICAgICAgY29udHJvbGxlcjogJ1Byb2ZpbGVDdHJsJyxcbiAgICAgIHRlbXBsYXRlVXJsOiAnanMvcHJvZmlsZS9wcm9maWxlLmh0bWwnXG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdQcm9maWxlQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsICRzdGF0ZSwgVGFnRmFjdG9yeSwgVXNlckZhY3RvcnksIEF1dGhTZXJ2aWNlLCAkbG9nLCBSZXNvdXJjZUZhY3RvcnksIFJlY29tbWVuZGF0aW9uRmFjdG9yeSwgR3VpZGVGYWN0b3J5KSB7XG4gICRzY29wZS5sb2FkZWQgPSBmYWxzZTtcbiAgJHNjb3BlLnNlbGVjdGVkVGFncyA9IFtdO1xuICAkc2NvcGUudXNlciA9IHt9O1xuXG4gIGZ1bmN0aW9uIHNodWZmbGVBcnJheShhcnJheSkge1xuICAgIGZvciAodmFyIGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIHZhciBqID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGkgKyAxKSk7XG4gICAgICAgIHZhciB0ZW1wID0gYXJyYXlbaV07XG4gICAgICAgIGFycmF5W2ldID0gYXJyYXlbal07XG4gICAgICAgIGFycmF5W2pdID0gdGVtcDtcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5O1xuICB9XG5cbiAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICB9KVxuICAudGhlbihmdW5jdGlvbihmdWxsVXNlcil7XG4gICAgJHNjb3BlLnVzZXIgPSBmdWxsVXNlcjsgLy8gZ2V0cyBjdXJyZW50IHVzZXJcbiAgICAkc2NvcGUuc2VsZWN0ZWRUYWdzID0gZnVsbFVzZXIudGFnczsgLy8gZ2V0cyB1c2VyJ3MgdGFncyAodG9waWNzIHVzZXIgaXMgaW50ZXJlc3RlZCBpbilcbiAgICAkc2NvcGUuZnJpZW5kcyA9IHNodWZmbGVBcnJheSgkc2NvcGUudXNlci5mcmllbmQpLnNsaWNlKDAsIDQpO1xuICAgIHJldHVybiBHdWlkZUZhY3RvcnkuZ2V0QnlBdXRob3IoJHNjb3BlLnVzZXIuaWQpXG4gIH0pXG4gIC50aGVuKGZ1bmN0aW9uKGd1aWRlcykge1xuICAgICRzY29wZS5ndWlkZXMgPSBndWlkZXM7XG4gICAgJHNjb3BlLm5vR3VpZGVzID0gJHNjb3BlLmd1aWRlcy5sZW5ndGggPT09IDA7XG4gICAgaWYgKCRzY29wZS5zZWxlY3RlZFRhZ3MubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmV0Y2hSZXNvdXJjZXMoJHNjb3BlLnNlbGVjdGVkVGFncylcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAkc2NvcGUubm9UYWdzID0gdHJ1ZTtcbiAgICB9XG4gIH0pXG4gIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5sb2FkZWQgPSB0cnVlO1xuICAgICRzY29wZS4kd2F0Y2hDb2xsZWN0aW9uKCdzZWxlY3RlZFRhZ3MnLCBmdW5jdGlvbigpIHtcbiAgICAgIF8uZGVib3VuY2UodXBkYXRlUGFnZSwgMTAwMCkoKTtcbiAgICB9KTtcbiAgfSlcbiAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZVBhZ2UoKSB7XG4gICAgdXBkYXRlVGFncygpXG4gICAgLnRoZW4oZnVuY3Rpb24odGFncyl7XG4gICAgICBpZiAoJHNjb3BlLnNlbGVjdGVkVGFncy5sZW5ndGgpIHtcbiAgICAgICAgJHNjb3BlLm5vVGFncyA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmV0Y2hSZXNvdXJjZXModGFncyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgJHNjb3BlLm5vVGFncyA9IHRydWU7XG4gICAgICAgICRzY29wZS5yZXNvdXJjZXMgPSBbXTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgfVxuXG4gIC8vIHByb2ZpbGUgcGFnZSBkaXNwbGF5czogcmVjb21tZW5kZWQgcmVzb3VyY2VzLCBndWlkZXMgY3JlYXRlZCBieSB0aGUgdXNlciwgdXNlcidzIHBpY3R1cmUgJiBhY2NvdW50IHNldHRpbmdzLCAmIHVzZXIncyBmcmllbmRzXG4gIGZ1bmN0aW9uIGZldGNoUmVzb3VyY2VzKHVwZGF0ZWRUYWdzKSB7XG4gICAgdmFyIHRhZ3MgPSB1cGRhdGVkVGFncy5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICByZXR1cm4gK3RhZy5pZDtcbiAgICB9KTtcbiAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5VGFnKHRhZ3MpXG4gICAgLnRoZW4oZnVuY3Rpb24ocmVzb3VyY2VzKSB7XG4gICAgICAkc2NvcGUucmVzb3VyY2VzID0gUmVjb21tZW5kYXRpb25GYWN0b3J5LmdldChyZXNvdXJjZXMsICRzY29wZS51c2VyKVxuICAgICAgLm1hcChvYmogPT4gb2JqLnJlc291cmNlKS5zbGljZSgwLCA1KTtcbiAgICB9KVxuICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlUYWdzKHRhZ3MpXG4gICAgICAudGhlbihmdW5jdGlvbih1c2Vycyl7XG4gICAgICAgIGlmICh1c2Vycy5sZW5ndGggPiAwKXtcbiAgICAgICAgICB2YXIgc3VnZ2VzdGVkRnJpZW5kcyA9W107ICBcbiAgICAgICAgICAkc2NvcGUudXNlckZyaWVuZHNJZHMgPSAkc2NvcGUudXNlci5mcmllbmQubWFwKGZ1bmN0aW9uKGZyaWVuZCl7XG4gICAgICAgICAgICByZXR1cm4gK2ZyaWVuZC5pZFxuICAgICAgICAgIH0pXG4gICAgICAgICAgdXNlcnMubWFwKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgICAgaWYgKCRzY29wZS51c2VyRnJpZW5kc0lkcy5pbmRleE9mKHVzZXIuaWQpID09PSAtMSAmJiAkc2NvcGUudXNlci5pZCAhPT0gdXNlci5pZCl7XG4gICAgICAgICAgICAgIHN1Z2dlc3RlZEZyaWVuZHMucHVzaCh1c2VyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgICRzY29wZS5zdWdnZXN0ZWRGcmllbmRzID0gc2h1ZmZsZUFycmF5KHN1Z2dlc3RlZEZyaWVuZHMpLnNsaWNlKDAsNCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIHVwZGF0ZVRhZ3MoKSB7XG4gICAgdmFyIHRhZ3MgPSAkc2NvcGUuc2VsZWN0ZWRUYWdzLm1hcChmdW5jdGlvbih0YWcpe1xuICAgICAgaWYgKHR5cGVvZiB0YWcgPT09ICdvYmplY3QnKSByZXR1cm4gdGFnLnRpdGxlO1xuICAgICAgZWxzZSByZXR1cm4gdGFnO1xuICAgIH0pO1xuICAgIHJldHVybiBVc2VyRmFjdG9yeS5zZXRUYWdzKCRzY29wZS51c2VyLmlkLCB0YWdzKVxuICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgfVxuXG4gICRzY29wZS5maW5kRnJpZW5kID0gZnVuY3Rpb24oZnJpZW5kSWQpIHtcbiAgICAkc3RhdGUuZ28oJ2ZyaWVuZCcsIHtmcmllbmRJZDogZnJpZW5kSWR9KTtcbiAgfTtcblxuICAkc2NvcGUuZmluZEZyaWVuZHMgPSBmdW5jdGlvbih1c2VySWQpIHtcbiAgICAkc3RhdGUuZ28oJ2ZyaWVuZHMnLCB7dXNlcklkOiB1c2VySWR9KTtcbiAgfVxuXG4gICRzY29wZS52aWV3TGlrZWRSZXNvdXJjZXMgPSBmdW5jdGlvbigpIHtcbiAgICAkc3RhdGUuZ28oJ2xpa2VkUmVzb3VyY2VzJywge3VzZXJJZDogJHNjb3BlLnVzZXIuaWR9KTtcbiAgfVxuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdzZWFyY2hQZW9wbGUnLCB7XG4gICAgICB1cmw6ICcvc2VhcmNoX3Blb3BsZScsXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL3NlYXJjaF9wZW9wbGUvc2VhcmNoX3Blb3BsZS5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdzZWFyY2hQZW9wbGVDdHJsJ1xuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignc2VhcmNoUGVvcGxlQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCBVc2VyRmFjdG9yeSwgJGxvZykge1xuICBVc2VyRmFjdG9yeS5nZXRBbGwoKVxuICAudGhlbihmdW5jdGlvbih1c2Vycyl7XG4gICAgJHNjb3BlLnVzZXJzID0gdXNlcnM7XG4gIH0pXG4gIC5jYXRjaCgkbG9nLmVycm9yKTtcblxuICAkc2NvcGUuZmluZEZyaWVuZCA9IGZ1bmN0aW9uKHVzZXJJZCl7XG4gICAgJHN0YXRlLmdvKCdmcmllbmQnLCB7ZnJpZW5kSWQ6IHVzZXJJZH0pXG4gIH1cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2VhcmNoUmVzdWx0cycsIHtcbiAgICB1cmw6ICcvc2VhcmNoX3Jlc3VsdHMvdGFncy86dGFnSWRzLzp0YWdUaXRsZXMnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvc2VhcmNoX3Jlc3VsdHMvc2VhcmNoX3Jlc3VsdHMuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ1NlYXJjaEN0cmwnLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIHVzZXI6IGZ1bmN0aW9uKEF1dGhTZXJ2aWNlLCBVc2VyRmFjdG9yeSl7XG4gICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICBpZiAoIXVzZXIpe1xuICAgICAgICAgICAgcmV0dXJuIHtpZDogMCwgbmFtZTogJ0d1ZXN0JywgZnJpZW5kOiBbXSwgcmVzb3VyY2VMaWtlOiBbXSwgcmVzb3VyY2VEaXNsaWtlOiBbXSwgZ3VpZGVMaWtlOiBbXSwgZ3VpZGVEaXNsaWtlOiBbXX1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5SWQodXNlci5pZCk7XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignU2VhcmNoQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlUGFyYW1zLCBSZXNvdXJjZUZhY3RvcnksIEd1aWRlRmFjdG9yeSwgdXNlciwgJGxvZykge1xuICAkc2NvcGUudGFncyA9ICRzdGF0ZVBhcmFtcy50YWdUaXRsZXMuc3BsaXQoJysnKTtcbiAgbGV0IHRhZ3MgPSAkc3RhdGVQYXJhbXMudGFnSWRzLnNwbGl0KCcrJylcbiAgICB0YWdzID0gdGFncy5tYXAoZnVuY3Rpb24oaWQpe1xuICAgIHJldHVybiAraWQ7XG4gIH0pO1xuICAkc2NvcGUudXNlciA9IHVzZXI7XG4gIFJlc291cmNlRmFjdG9yeS5nZXRBbGxCeVRhZyh0YWdzKVxuICAudGhlbihmdW5jdGlvbihyZXNvdXJjZXMpe1xuICAgICRzY29wZS5yZXNvdXJjZXMgPSByZXNvdXJjZXMuc29ydChmdW5jdGlvbihhLCBiKXtcbiAgICAgICAgICAgIGlmIChhLm5ldExpa2VzID4gYi5uZXRMaWtlcykge1xuICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYS5uZXRMaWtlcyA8IGIubmV0TGlrZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgIH0pXG4gICAkc2NvcGUuZGF0YSA9ICRzY29wZS5yZXNvdXJjZXMuc2xpY2UoMCwgNSk7XG4gIH0pXG4gIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgJHNjb3BlLmdldE1vcmVEYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICAgJHNjb3BlLmRhdGEgPSAkc2NvcGUucmVzb3VyY2VzLnNsaWNlKDAsICRzY29wZS5kYXRhLmxlbmd0aCArIDUpO1xuICAgIH1cbiAgfSlcbiAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuXG4gIEd1aWRlRmFjdG9yeS5nZXRBbGxCeVRhZyh0YWdzKVxuICAudGhlbihmdW5jdGlvbihndWlkZXMpe1xuICAgICRzY29wZS5ndWlkZXMgPSBndWlkZXM7XG4gIH0pXG4gIC5jYXRjaCgkbG9nLmVycm9yKTtcblxuICAkc2NvcGUudXNlckd1aWRlcyA9IHVzZXIuZ3VpZGVzO1xufSk7XG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2lnbnVwJywge1xuICAgICAgICB1cmw6ICcvc2lnbnVwJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zaWdudXAvc2lnbnVwLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU2lnbnVwQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTaWdudXBDdHJsJywgZnVuY3Rpb24gKCRsb2csICRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgVGFnRmFjdG9yeSkge1xuXG4gICAgJHNjb3BlLmNoZWNrSW5mbyA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgJHNjb3BlLnVzZXIgPSB7fTtcblxuICAgICRzY29wZS5zZW5kU2lnblVwID0gZnVuY3Rpb24oc2lnblVwSW5mbykge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIGlmICgkc2NvcGUudXNlci5wYXNzd29yZCAhPT0gJHNjb3BlLnVzZXIucGFzc3dvcmRDb25maXJtKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnUGFzc3dvcmRzIGRvIG5vdCBtYXRjaCwgcGxlYXNlIHJlLWVudGVyIHBhc3N3b3JkLic7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBBdXRoU2VydmljZS5zaWdudXAoc2lnblVwSW5mbylcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVGFnRmFjdG9yeS5nZXRBbGwoKVxuICAgIC50aGVuKGZ1bmN0aW9uKHRhZ3Mpe1xuICAgIHZhciBhbGxUYWdzID0gdGFncztcblxuICAgICRzY29wZS5hbGxUYWdzID0gYWxsVGFncztcbiAgICAkc2NvcGUudXNlci50YWdzID0gW107XG5cbiAgICAkc2NvcGUucXVlcnlUYWdzID0gZnVuY3Rpb24oc2VhcmNoKSB7XG4gICAgICB2YXIgZmlyc3RQYXNzID0gYWxsVGFncy5maWx0ZXIoZnVuY3Rpb24odGFnKXtcbiAgICAgICAgcmV0dXJuIHRhZy50aXRsZS5pbmNsdWRlcyhzZWFyY2gudG9Mb3dlckNhc2UoKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBmaXJzdFBhc3MuZmlsdGVyKGZ1bmN0aW9uKHRhZyl7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAkc2NvcGUudXNlci50YWdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICBpZiAodGFnLnRpdGxlID09PSBzZWFyY2gpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAkc2NvcGUuYWRkVGFnID0gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgJHNjb3BlLnVzZXIudGFncy5wdXNoKGdyb3VwKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLiR3YXRjaENvbGxlY3Rpb24oJ3VzZXIudGFncycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAkc2NvcGUuYXZhaWxhYmxlVGFncyA9ICRzY29wZS5xdWVyeVRhZ3MoJycpO1xuICAgIH0pO1xuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0RhdGFGYWN0b3J5JywgZnVuY3Rpb24oKXtcbiAgICBsZXQgRGF0YUZhY3RvcnkgPSB7fTtcblxuICAgIERhdGFGYWN0b3J5LmdldERhdGEgPSBmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhXG4gICAgfVxuICAgIHJldHVybiBEYXRhRmFjdG9yeTtcbn0pXG4iLCJhcHAuZmFjdG9yeSgnR3VpZGVGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIERhdGFGYWN0b3J5KSB7XG4gICAgbGV0IEd1aWRlRmFjdG9yeSA9IHt9O1xuXG4gICAgR3VpZGVGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL2d1aWRlcycpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cbiAgICBHdWlkZUZhY3RvcnkuZ2V0QWxsQnlUYWcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHRhZ0lkcyA9IFsuLi5hcmd1bWVudHNdXG4gICAgICAgIHRhZ0lkcyA9IHRhZ0lkcy5qb2luKCcsJyk7XG4gICAgICAgIC8vICdhcGkvZ3VpZGVzP3RhZ0lkcz0xLDIsMydcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXM/dGFnSWRzPScgKyB0YWdJZHMpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cbiAgICBHdWlkZUZhY3RvcnkuZ2V0QnlBdXRob3IgPSBmdW5jdGlvbihhdXRob3JJZCkge1xuICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXM/YXV0aG9ySWQ9JyArIGF1dGhvcklkKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG4gICAgfVxuICAgR3VpZGVGYWN0b3J5LmdldEJ5SWQgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXMvJyArIGlkKVxuICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LmFkZE5ld0d1aWRlID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9hcGkvZ3VpZGVzJywgZGF0YSlcbiAgICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcbiAgIH1cbiAgIEd1aWRlRmFjdG9yeS5hZGRSZXNvdXJjZSA9IGZ1bmN0aW9uKGlkLCBkYXRhKXtcbiAgICAgICByZXR1cm4gJGh0dHAucHV0KCcvYXBpL2d1aWRlcy8nICsgaWQgKyAnL2FkZCcsIGRhdGEpXG4gICB9XG4gICBHdWlkZUZhY3RvcnkucmVtb3ZlUmVzb3VyY2UgPSBmdW5jdGlvbihpZCwgZGF0YSl7XG4gICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9kZWxldGUnLCBkYXRhKVxuICAgfVxuICAgR3VpZGVGYWN0b3J5Lmxpa2UgPSBmdW5jdGlvbihpZCkge1xuICAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvZ3VpZGVzLycgKyBpZCArICcvbGlrZScpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LmRpc2xpa2UgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9kaXNsaWtlJyk7XG4gICB9XG4gICBHdWlkZUZhY3RvcnkuZGVsZXRlID0gZnVuY3Rpb24oaWQpe1xuICAgICAgIHJldHVybiAkaHR0cC5kZWxldGUoJy9hcGkvZ3VpZGVzLycgKyBpZCArJy9kZWxldGVndWlkZScpO1xuICAgfVxuXG4gICBHdWlkZUZhY3RvcnkudXBkYXRlT3JkZXIgPSBmdW5jdGlvbihpZCwgZGF0YSl7XG4gICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9vcmRlcicsIGRhdGEpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LnJlbW92ZUxpa2UgPSBmdW5jdGlvbihpZCwgdXNlcklkKSB7XG4gICAgcmV0dXJuICRodHRwLmRlbGV0ZSgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9saWtlL3VzZXJzLycgKyB1c2VySWQpO1xuICB9O1xuICBHdWlkZUZhY3RvcnkucmVtb3ZlRGlzbGlrZSA9IGZ1bmN0aW9uKGlkLCB1c2VySWQpIHtcbiAgICByZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL2d1aWRlcy8nICsgaWQgKyAnL2Rpc2xpa2UvdXNlcnMvJyArIHVzZXJJZCk7XG4gIH07XG4gICByZXR1cm4gR3VpZGVGYWN0b3J5XG59KTtcblxuIiwiYXBwLmZhY3RvcnkoJ1JlY29tbWVuZGF0aW9uRmFjdG9yeScsIGZ1bmN0aW9uKCkge1xuICB2YXIgUmVjb21tZW5kYXRpb25GYWN0b3J5ID0ge307XG5cbiAgbGV0IGludGVyc2VjdCA9IGZ1bmN0aW9uKGEsIGIpe1xuICAgIGxldCBhaSA9IDAsIGJpID0gMDtcbiAgICBsZXQgcmVzdWx0ID0gW107XG5cbiAgICB3aGlsZSAoIGFpIDwgYS5sZW5ndGggJiYgYmkgPCBiLmxlbmd0aCApe1xuICAgICAgaWYgKGFbYWldIDwgYltiaV0gKXtcbiAgICAgICAgIGFpKys7XG4gICAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGFbYWldID4gYltiaV0gKXtcbiAgICAgICAgIGJpKys7XG4gICAgICAgIH1cbiAgICAgIGVsc2UgeyAvKiB0aGV5J3JlIGVxdWFsICovXG4gICAgICAgIHJlc3VsdC5wdXNoKGFbYWldKTtcbiAgICAgICAgYWkrKztcbiAgICAgICAgYmkrKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBsZXQgY29tcGFyZSA9IGZ1bmN0aW9uKGEsIGIpe1xuICAgIGlmIChhLnJhdGluZyA8IGIucmF0aW5nKSByZXR1cm4gMTtcbiAgICBpZiAoYS5yYXRpbmcgPiBiLnJhdGluZykgcmV0dXJuIC0xO1xuICAgIHJldHVybiAwXG4gIH07XG5cbiAgZnVuY3Rpb24gc2h1ZmZsZShhcnJheSkge1xuICAgIHZhciBjb3B5ID0gW10sIG4gPSBhcnJheS5sZW5ndGgsIGk7XG4gICAgLy8gV2hpbGUgdGhlcmUgcmVtYWluIGVsZW1lbnRzIHRvIHNodWZmbGXigKZcbiAgICB3aGlsZSAobikge1xuICAgICAgICAvLyBQaWNrIGEgcmVtYWluaW5nIGVsZW1lbnTigKZcbiAgICAgICAgaSA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFycmF5Lmxlbmd0aCk7XG5cbiAgICAgIC8vIElmIG5vdCBhbHJlYWR5IHNodWZmbGVkLCBtb3ZlIGl0IHRvIHRoZSBuZXcgYXJyYXkuXG4gICAgICBpZiAoaSBpbiBhcnJheSkge1xuICAgICAgICBjb3B5LnB1c2goYXJyYXlbaV0pO1xuICAgICAgICBkZWxldGUgYXJyYXlbaV07XG4gICAgICAgIG4tLTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvcHk7XG4gIH1cblxuICBSZWNvbW1lbmRhdGlvbkZhY3RvcnkuZ2V0ID0gZnVuY3Rpb24ocmVzb3VyY2VzLCBjdXJyZW50VXNlcikge1xuICAgIGxldCByZWNvbW1lbmRlZCA9IFtdO1xuICAgIGxldCBzaHVmZmxlR3JvdXAgPSBbXTtcbiAgICBcbiAgICByZXNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbihyZXNvdXJjZSl7XG4gICAgICAvL0Zvcm11bGEgZm9yIGNhbGN1bGF0aW5nIGhvdyBtYW55IGZyaWVuZHMgbGlrZSBlYWNoIHJlc291cmNlLlxuICAgICAgdmFyIGN1cnJlbnRSYXRpbmcgPSBpbnRlcnNlY3QoY3VycmVudFVzZXIuZnJpZW5kLCByZXNvdXJjZS5saWtlVXNlcikubGVuZ3RoIC0gaW50ZXJzZWN0KGN1cnJlbnRVc2VyLmZyaWVuZCwgcmVzb3VyY2UuZGlzbGlrZVVzZXIpLmxlbmd0aDtcbiAgICAgIGlmIChjdXJyZW50UmF0aW5nID49IDAgJiYgKHJlc291cmNlLmRpc2xpa2VVc2VyLmluZGV4T2YoY3VycmVudFVzZXIuaWQpID09PSAtMSkgJiYgKHJlc291cmNlLmxpa2VVc2VyLmluZGV4T2YoY3VycmVudFVzZXIuaWQpID09PSAtMSkpe1xuICAgICAgICB2YXIgb2JqID0ge3Jlc291cmNlOiByZXNvdXJjZSwgcmF0aW5nOiBjdXJyZW50UmF0aW5nfTtcbiAgICAgICAgaWYgKGN1cnJlbnRSYXRpbmcgPT09IDApIHNodWZmbGVHcm91cC5wdXNoKG9iaik7XG4gICAgICAgIGVsc2UgcmVjb21tZW5kZWQucHVzaChvYmopO1xuICAgICAgfVxuICAgIH0pXG4gICAgc2h1ZmZsZUdyb3VwID0gc2h1ZmZsZShzaHVmZmxlR3JvdXApO1xuICAgIHJlY29tbWVuZGVkID0gcmVjb21tZW5kZWQuY29uY2F0KHNodWZmbGVHcm91cCk7XG4gICAgLy9Vc2VzIGFycmF5LnNvcnQgdG8gc29ydCB0aGUgcmVjb21tZW5kZWQgcmVzb3VyY2VzIG51bWVyaWNhbGx5IGJ5IHJhdGluZ1xuICAgIHJldHVybiByZWNvbW1lbmRlZC5zb3J0KGNvbXBhcmUpO1xuICB9XG4gIHJldHVybiBSZWNvbW1lbmRhdGlvbkZhY3Rvcnk7XG59KTtcbiIsImFwcC5mYWN0b3J5KCdSZXNvdXJjZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgRGF0YUZhY3RvcnkpIHtcblx0bGV0IFJlc291cmNlRmFjdG9yeSA9IHt9O1xuXG5cdFJlc291cmNlRmFjdG9yeS5nZXRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcycpXG5cdFx0LnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG5cdH07XG5cdFJlc291cmNlRmFjdG9yeS5nZXRBbGxCeVRhZyA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB0YWdJZHMgPSBbLi4uYXJndW1lbnRzXTtcblx0XHR0YWdJZHMgPSB0YWdJZHMuam9pbignLCcpO1xuXHRcdC8vICAnL2FwaS9yZXNvdXJjZXM/dGFnSWRzPTEsMiwzLCdcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcz90YWdJZHM9JyArIHRhZ0lkcylcblx0XHQudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlUeXBlID0gZnVuY3Rpb24odHlwZSkge1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvcmVzb3VyY2VzP3R5cGU9JyArIHR5cGUpXG5cdFx0LnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5QXV0aG9yID0gZnVuY3Rpb24oYXV0aG9yKXtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcz9hdXRob3I9JyArIGF1dGhvcilcblx0XHQudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlTb3VyY2UgPSBmdW5jdGlvbihzb3VyY2Upe1xuXHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKCcrJywgJyUyQicpO1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvcmVzb3VyY2VzP3NvdXJjZT0nICsgc291cmNlKVxuXHRcdC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuXHR9XG5cblx0UmVzb3VyY2VGYWN0b3J5LmdldEJ5SWQgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvcmVzb3VyY2VzLycgKyBpZClcblx0XHQudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkucG9zdCA9IGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRyZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9yZXNvdXJjZXMnLCBkYXRhKVxuXHRcdC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuXHR9O1xuXG5cdFJlc291cmNlRmFjdG9yeS5saWtlID0gZnVuY3Rpb24oaWQpIHtcblx0XHRyZXR1cm4gJGh0dHAucHV0KCcvYXBpL3Jlc291cmNlcy8nICsgaWQgKyAnL2xpa2UnKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkuZGlzbGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLnB1dCgnL2FwaS9yZXNvdXJjZXMvJyArIGlkICsgJy9kaXNsaWtlJyk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LnJlbW92ZUxpa2UgPSBmdW5jdGlvbihpZCwgdXNlcklkKSB7XG5cdFx0cmV0dXJuICRodHRwLmRlbGV0ZSgnL2FwaS9yZXNvdXJjZXMvJyArIGlkICsgJy9saWtlL3VzZXJzLycgKyB1c2VySWQpO1xuXHR9O1xuXG5cdFJlc291cmNlRmFjdG9yeS5yZW1vdmVEaXNsaWtlID0gZnVuY3Rpb24oaWQsIHVzZXJJZCkge1xuXHRcdHJldHVybiAkaHR0cC5kZWxldGUoJy9hcGkvcmVzb3VyY2VzLycgKyBpZCArICcvZGlzbGlrZS91c2Vycy8nICsgdXNlcklkKTtcblx0fTtcblxuUmVzb3VyY2VGYWN0b3J5LmRlbGV0ZSA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLmRlbGV0ZSgnYXBpL3Jlc291cmNlcy8nICsgaWQpO1xufTtcblx0cmV0dXJuIFJlc291cmNlRmFjdG9yeTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1RhZ0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgRGF0YUZhY3Rvcnkpe1xuICAgIGxldCBUYWdGYWN0b3J5ID0ge307XG5cbiAgICBUYWdGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdGFncycpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpXG4gICAgfVxuICAgIFRhZ0ZhY3RvcnkuYWRkVGFnID0gZnVuY3Rpb24oaW5mbyl7XG4gICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL3RhZ3MnLCBpbmZvKVxuICAgICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKVxuICAgIH1cblxuICAgIFRhZ0ZhY3RvcnkuZ2V0QnlJZCA9IGZ1bmN0aW9uKGlkKXtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS90YWdzLycgKyBpZClcbiAgICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSlcbiAgICB9XG4gICAgcmV0dXJuIFRhZ0ZhY3Rvcnk7XG59KVxuIiwiYXBwLmZhY3RvcnkoJ1VzZXJGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIERhdGFGYWN0b3J5KXtcbiAgICBsZXQgVXNlckZhY3RvcnkgPSB7fTtcblxuICAgIFVzZXJGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3VzZXJzJylcbiAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpXG4gICAgfVxuXG4gICAgVXNlckZhY3RvcnkuZ2V0QnlJZCA9IGZ1bmN0aW9uKGlkKXtcbiAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdXNlcnMvJyArIGlkKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSlcbiAgICB9XG5cbiAgICBVc2VyRmFjdG9yeS5hZGRVc2VyID0gZnVuY3Rpb24oaW5mbyl7XG4gICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2FwaS91c2VycycsIGluZm8pXG4gICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKVxuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LnNldFRhZ3MgPSBmdW5jdGlvbihpZCwgdGFncykge1xuICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS91c2Vycy8nICsgaWQgKyAnL3NldHRhZ3MnLCB0YWdzKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG4gICAgfVxuXG4gICAgVXNlckZhY3RvcnkuZ2V0QnlUYWdzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdGFnSWRzID0gWy4uLmFyZ3VtZW50c107XG4gICAgICB0YWdJZHMgPSB0YWdJZHMuam9pbignLCcpO1xuICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS91c2Vycz90YWdJZHM9JyArIHRhZ0lkcylcbiAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LmFkZEZyaWVuZCA9IGZ1bmN0aW9uKHVzZXJJZCwgZnJpZW5kSWQpIHtcbiAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvdXNlcnMvJyArIHVzZXJJZCArICcvYWRkRnJpZW5kJywgZnJpZW5kSWQpO1xuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LmRlbGV0ZUZyaWVuZCA9IGZ1bmN0aW9uKHVzZXJJZCwgZnJpZW5kSWQpIHtcbiAgICAgIHJldHVybiAkaHR0cC5kZWxldGUoJy9hcGkvdXNlcnMvJyArIHVzZXJJZCArICcvZGVsZXRlRnJpZW5kLycgKyBmcmllbmRJZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFVzZXJGYWN0b3J5O1xufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3NlYXJjaEF1dGhvclJlc3VsdHMnLCB7XG4gICAgdXJsOiAnL3NlYXJjaF9yZXN1bHRzL2F1dGhvci86YXV0aG9yTmFtZScsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9zZWFyY2hfcmVzdWx0cy9zZWFyY2hfcmVzdWx0cy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnU2VhcmNoQXV0aG9yQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgdXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UsIFVzZXJGYWN0b3J5KXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgIGlmICghdXNlcil7XG4gICAgICAgICAgICByZXR1cm4ge2lkOiAwLCBuYW1lOiAnR3Vlc3QnLCBmcmllbmQ6IFtdLCByZXNvdXJjZUxpa2U6IFtdLCByZXNvdXJjZURpc2xpa2U6IFtdLCBndWlkZUxpa2U6IFtdLCBndWlkZURpc2xpa2U6IFtdfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTZWFyY2hBdXRob3JDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBSZXNvdXJjZUZhY3RvcnksICRsb2csIHVzZXIsICRzdGF0ZVBhcmFtcykge1xuICAkc2NvcGUuYXV0aG9yID0gJHN0YXRlUGFyYW1zLmF1dGhvck5hbWU7XG4gICRzY29wZS51c2VyID0gdXNlcjtcbiAgJHNjb3BlLmd1aWRlcyA9IFtdO1xuICBSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlBdXRob3IoJHN0YXRlUGFyYW1zLmF1dGhvck5hbWUpXG4gIC50aGVuKGZ1bmN0aW9uKHJlc291cmNlcyl7XG4gICAgJHNjb3BlLnJlc291cmNlcyA9IHJlc291cmNlc1xuICAgICRzY29wZS5kYXRhID0gJHNjb3BlLnJlc291cmNlcy5zbGljZSgwLDUpO1xuICB9KVxuICAudGhlbihmdW5jdGlvbigpe1xuICAgICRzY29wZS5nZXRNb3JlRGF0YSA9IGZ1bmN0aW9uKCl7XG4gICAgICAkc2NvcGUuZGF0YSA9ICRzY29wZS5yZXNvdXJjZXMuc2xpY2UoMCwgJHNjb3BlLmRhdGEubGVuZ3RoICsgNSk7XG4gICAgfTtcbiAgfSlcbiAgLmNhdGNoKCRsb2cuZXJyb3IpO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdzZWFyY2hTb3VyY2VSZXN1bHRzJywge1xuICAgIHVybDogJy9zZWFyY2hfcmVzdWx0cy9zb3VyY2UvOnNvdXJjZScsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9zZWFyY2hfcmVzdWx0cy9zZWFyY2hfcmVzdWx0cy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnU2VhcmNoU291cmNlQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgdXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UsIFVzZXJGYWN0b3J5KXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgIGlmICghdXNlcil7XG4gICAgICAgICAgICByZXR1cm4ge2lkOiAwLCBuYW1lOiAnR3Vlc3QnLCBmcmllbmQ6IFtdLCByZXNvdXJjZUxpa2U6IFtdLCByZXNvdXJjZURpc2xpa2U6IFtdLCBndWlkZUxpa2U6IFtdLCBndWlkZURpc2xpa2U6IFtdfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTZWFyY2hTb3VyY2VDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBSZXNvdXJjZUZhY3RvcnksICRsb2csIHVzZXIsICRzdGF0ZVBhcmFtcykge1xuICAkc2NvcGUuc291cmNlID0gJHN0YXRlUGFyYW1zLnNvdXJjZVxuICAkc2NvcGUudXNlciA9IHVzZXJcbiAgJHNjb3BlLmd1aWRlcyA9IFtdO1xuICBSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlTb3VyY2UoJHN0YXRlUGFyYW1zLnNvdXJjZSlcbiAgLnRoZW4oZnVuY3Rpb24ocmVzb3VyY2VzKXtcbiAgICAkc2NvcGUucmVzb3VyY2VzID0gcmVzb3VyY2VzXG4gICAgJHNjb3BlLmRhdGEgPSAkc2NvcGUucmVzb3VyY2VzLnNsaWNlKDAsIDUpO1xuICB9KVxuICAudGhlbihmdW5jdGlvbigpe1xuICAgICRzY29wZS5nZXRNb3JlRGF0YSA9IGZ1bmN0aW9uKCl7XG4gICAgICAkc2NvcGUuZGF0YSA9ICRzY29wZS5yZXNvdXJjZXMuc2xpY2UoMCwgJHNjb3BlLmRhdGEubGVuZ3RoICsgNSk7XG4gICAgfVxuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ2FkZFRvR3VpZGUnLCBmdW5jdGlvbigkbWREaWFsb2csICRtZFRvYXN0LCBHdWlkZUZhY3RvcnksICRsb2csICRyb290U2NvcGUpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9hZGQtdG8tZ3VpZGUvYWRkLXRvLWd1aWRlLmh0bWwnLFxuXHRcdHNjb3BlOiB7XG4gICAgICByZXNvdXJjZTogJz0nLFxuICAgICAgdXNlckd1aWRlczogJz0nLFxuICAgICAgdXNlcjogJz0nXG4gICAgfSxcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSkge1xuXHRcdFx0c2NvcGUuZ3VpZGUgPSB7dGFnczogW119XG4gICAgICBzY29wZS5vcGVuUGFuZWwgPSBmYWxzZTtcblxuXHRcdFx0c2NvcGUubmV3R3VpZGUgPSBmYWxzZTtcblx0XHRcdHNjb3BlLm9wZW5Ub2FzdCA9IGZ1bmN0aW9uKCl7XG5cdFx0XHRcdCRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKClcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQudGV4dENvbnRlbnQoJ1Jlc291cmNlIGFkZGVkIHRvIEd1aWRlIScpKTtcblx0XHRcdH1cblxuXHRcdFx0c2NvcGUuc2hvd0FkdmFuY2VkID0gZnVuY3Rpb24oKXtcblx0XHRcdFx0JG1kRGlhbG9nLnNob3coe1xuICAgICAgICAgIHNjb3BlOiBzY29wZSxcbiAgICAgICAgICBwcmVzZXJ2ZVNjb3BlOiB0cnVlLFxuXHRcdFx0XHRcdHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvYWRkLXRvLWd1aWRlL2RpYWxvZy10ZW1wbGF0ZS5odG1sJyxcblx0XHRcdFx0XHRjbGlja091dHNpZGVUb0Nsb3NlOiB0cnVlLFxuXHRcdFx0XHRcdGVzY2FwZVRvQ2xvc2U6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5jbGVhckZvcm0gPSBmdW5jdGlvbigpe1xuXHRcdFx0XHRzY29wZS5ndWlkZUZvcm0uJHNldFByaXN0aW5lKCk7XG5cdFx0XHRcdHNjb3BlLmd1aWRlRm9ybS4kc2V0VW50b3VjaGVkKCk7XG5cdFx0XHRcdHNjb3BlLmd1aWRlID0ge3RhZ3M6IFtdfVxuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5zdWJtaXRGb3JtID0gZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKHNjb3BlLmd1aWRlLmlkKXtcblx0XHRcdFx0XHRyZXR1cm4gR3VpZGVGYWN0b3J5LmFkZFJlc291cmNlKHNjb3BlLmd1aWRlLmlkLCBzY29wZS5yZXNvdXJjZSlcblx0XHRcdFx0XHQudGhlbihmdW5jdGlvbigpe1xuXHRcdFx0XHRcdFx0c2NvcGUuY2xlYXJGb3JtKCk7XG5cdFx0XHRcdFx0XHQkbWREaWFsb2cuaGlkZSgpO1xuXHRcdFx0XHRcdFx0c2NvcGUub3BlblRvYXN0KCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChzY29wZS5ndWlkZS50aXRsZSl7XG5cdFx0XHRcdFx0cmV0dXJuIEd1aWRlRmFjdG9yeS5hZGROZXdHdWlkZSh7dGl0bGU6IHNjb3BlLmd1aWRlLnRpdGxlLCBhdXRob3I6IHNjb3BlLnVzZXIsIGRlc2NyaXB0aW9uOiBzY29wZS5ndWlkZS5kZXNjcmlwdGlvbiwgdGFnczogc2NvcGUuZ3VpZGUudGFnc30pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oZ3VpZGUpe1xuXHRcdFx0XHRcdFx0cmV0dXJuIEd1aWRlRmFjdG9yeS5hZGRSZXNvdXJjZShndWlkZS5pZCwgc2NvcGUucmVzb3VyY2UpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnbmV3IGd1aWRlJyk7XG5cdFx0XHRcdFx0XHRzY29wZS5jbGVhckZvcm0oKTtcblx0XHRcdFx0XHRcdCRtZERpYWxvZy5oaWRlKCk7XG5cdFx0XHRcdFx0XHRzY29wZS5vcGVuVG9hc3QoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC5jYXRjaCgkbG9nLmVycm9yKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgnZmFiJywgZnVuY3Rpb24gKCRtZERpYWxvZywgQXV0aFNlcnZpY2UsICRsb2csIFVzZXJGYWN0b3J5LCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgUmVzb3VyY2VGYWN0b3J5LCAkbWRUb2FzdCwgR3VpZGVGYWN0b3J5KSB7XG5yZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9mYWIvZmFiLmh0bWwnLFxuICAgIHNjb3BlOiB0cnVlLFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlKSB7XG4gICAgICBzY29wZS5yZXNvdXJjZSA9IHt0YWdzOiBbXX07XG4gICAgICBzY29wZS50eXBlcyA9IFtcbiAgICAgICAgJ2FydGljbGUnLFxuICAgICAgICAnYm9vaycsXG4gICAgICAgICdibG9nJyxcbiAgICAgICAgJ3BvZGNhc3QnLFxuICAgICAgICAnd2Vic2l0ZSdcbiAgICAgIF07XG5cbiAgICAgIHNjb3BlLm9wZW5Ub2FzdCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgJG1kVG9hc3Quc2hvdygkbWRUb2FzdC5zaW1wbGUoKVxuICAgICAgICAgICAgICAgICAgICAgIC50ZXh0Q29udGVudChtZXNzYWdlKSk7XG4gICAgICB9O1xuXG4gICAgICB2YXIgZ2V0R3VpZGVzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgICAgIHNjb3BlLmxvZ2dlZEluID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2NvcGUubG9nZ2VkSW4gPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5SWQodXNlci5pZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAudGhlbihmdW5jdGlvbihmdWxsVXNlcil7XG4gICAgICAgICAgc2NvcGUuZ3VpZGVzID0gZnVsbFVzZXIuZ3VpZGVzO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gICAgICB9O1xuXG4gICAgICB2YXIgY2xlYXJHdWlkZXMgPSBmdW5jdGlvbigpe1xuICAgICAgICBzY29wZS5ndWlkZXMgPSBbXTtcbiAgICAgICAgc2NvcGUubG9nZ2VkSW4gPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgc2NvcGUuc2hvd0RpYWxvZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkbWREaWFsb2cuc2hvdyh7XG4gICAgICAgICAgY29udGVudEVsZW1lbnQ6ICcjcmVzb3VyY2VEaWFsb2cnLFxuICAgICAgICAgIHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuICAgICAgICAgIGNsaWNrT3V0c2lkZVRvQ2xvc2U6IHRydWUsXG4gICAgICAgICAgZXNjYXBlVG9DbG9zZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIHNjb3BlLmNsZWFyRm9ybSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHNjb3BlLnJlc291cmNlRm9ybS4kc2V0UHJpc3RpbmUoKTtcbiAgICAgICAgc2NvcGUucmVzb3VyY2VGb3JtLiRzZXRVbnRvdWNoZWQoKTtcbiAgICAgICAgc2NvcGUucmVzb3VyY2UgPSB7dGFnczogW119O1xuICAgICAgfVxuXG4gICAgICBzY29wZS5zdWJtaXRGb3JtID0gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGNyZWF0ZWQ7XG4gICAgICAgIGlmIChzY29wZS5yZXNvdXJjZS50YWdzLmxlbmd0aCA9PT0gMCl7XG4gICAgICAgICAgICBzY29wZS5yZXNvdXJjZUZvcm0udGFncy4kaW52YWxpZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2NvcGUucmVzb3VyY2VGb3JtLiR2YWxpZCkge1xuICAgICAgICAgIFJlc291cmNlRmFjdG9yeS5wb3N0KHNjb3BlLnJlc291cmNlKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAgICAgICBjcmVhdGVkID0gcmVzdWx0LmNyZWF0ZWQ7XG4gICAgICAgICAgICBpZiAoc2NvcGUucmVzb3VyY2UuZ3VpZGUpIHtcbiAgICAgICAgICAgICAgdmFyIGd1aWRlSWQgPSBzY29wZS5yZXNvdXJjZS5ndWlkZTtcbiAgICAgICAgICAgICAgcmV0dXJuIEd1aWRlRmFjdG9yeS5hZGRSZXNvdXJjZShndWlkZUlkLCByZXN1bHQuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHJldHVybjtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgbWVzc2FnZSA9IGNyZWF0ZWQgPyAnUmVzb3VyY2UgY3JlYXRlZCEnIDogJ1Jlc291cmNlIGFscmVhZHkgZXhpc3RzISc7XG4gICAgICAgICAgICBpZiAoc2NvcGUucmVzb3VyY2UuZ3VpZGUpIG1lc3NhZ2UgKz0gJyBBZGRlZCB0byBndWlkZS4nXG4gICAgICAgICAgICBzY29wZS5jbGVhckZvcm0oKTtcbiAgICAgICAgICAgICRtZERpYWxvZy5oaWRlKCk7XG4gICAgICAgICAgICBzY29wZS5vcGVuVG9hc3QobWVzc2FnZSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGdldEd1aWRlcygpO1xuXG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIGdldEd1aWRlcyk7XG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCBjbGVhckd1aWRlcyk7XG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgY2xlYXJHdWlkZXMpO1xuICAgICAgJHJvb3RTY29wZS4kb24oJ25ldyBndWlkZScsIGdldEd1aWRlcyk7XG4gICAgfVxuICB9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ2d1aWRlQ2FyZCcsIGZ1bmN0aW9uKEd1aWRlRmFjdG9yeSwgJHN0YXRlLCAkbG9nKSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2d1aWRlLWNhcmQvZ3VpZGUtY2FyZC5odG1sJyxcbiAgICBzY29wZTogdHJ1ZSxcbiAgICBsaW5rOiBmdW5jdGlvbihzY29wZSkge1xuICAgICAgaWYgKHNjb3BlLnVzZXIuaWQgIT09IDApe1xuICAgICAgICBsZXQgbGlrZWQgPSBzY29wZS51c2VyLmd1aWRlTGlrZS5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgIHJldHVybiBpdGVtLmlkID09PSBzY29wZS5ndWlkZS5pZDtcbiAgICAgICAgfSkubGVuZ3RoID09PSAxO1xuXG4gICAgICAgIGxldCBkaXNsaWtlZCA9IHNjb3BlLnVzZXIuZ3VpZGVEaXNsaWtlLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgcmV0dXJuIGl0ZW0uaWQgPT09IHNjb3BlLmd1aWRlLmlkO1xuICAgICAgICB9KS5sZW5ndGggPT09IDE7XG5cbiAgICAgICAgc2NvcGUubGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgaWYgKHNjb3BlLnVzZXIuZ3VpZGVMaWtlLmZpbHRlcihmdW5jdGlvbihndWlkZSkge1xuICAgICAgICAgICAgcmV0dXJuIGd1aWRlLmlkID09PSBpZDtcbiAgICAgICAgICB9KS5sZW5ndGggPT09IDAgJiYgIWxpa2VkKXtcbiAgICAgICAgICAgIEd1aWRlRmFjdG9yeS5saWtlKGlkKVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGxpa2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgc2NvcGUuZ3VpZGUubGlrZXMgKz0gMTtcblxuICAgICAgICAgICAgICBpZiAoZGlzbGlrZWQpIHtcbiAgICAgICAgICAgICAgICBkaXNsaWtlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNjb3BlLmd1aWRlLmRpc2xpa2VzIC09IDE7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEd1aWRlRmFjdG9yeS5yZW1vdmVEaXNsaWtlKGlkLCBzY29wZS51c2VyLmlkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc2NvcGUuZGlzbGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgaWYgKHNjb3BlLnVzZXIuZ3VpZGVEaXNsaWtlLmZpbHRlcihmdW5jdGlvbihndWlkZSl7XG4gICAgICAgICAgICByZXR1cm4gZ3VpZGUuaWQgPT09IGlkO1xuICAgICAgICAgIH0pLmxlbmd0aCA9PT0gMCAmJiAhZGlzbGlrZWQpe1xuICAgICAgICAgICAgR3VpZGVGYWN0b3J5LmRpc2xpa2UoaWQpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgZGlzbGlrZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBzY29wZS5ndWlkZS5kaXNsaWtlcyArPSAxO1xuXG4gICAgICAgICAgICAgIGlmIChsaWtlZCkge1xuICAgICAgICAgICAgICAgIGxpa2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2NvcGUuZ3VpZGUubGlrZXMgLT0gMTtcbiAgICAgICAgICAgICAgICByZXR1cm4gR3VpZGVGYWN0b3J5LnJlbW92ZUxpa2UoaWQsIHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgc2NvcGUuZmluZEZyaWVuZCA9IGZ1bmN0aW9uKGZyaWVuZElkKSB7XG4gICAgICAgICAgJHN0YXRlLmdvKCdmcmllbmQnLCB7ZnJpZW5kSWQ6IGZyaWVuZElkfSk7XG4gICAgICB9O1xuICAgIH1cbiAgfTtcbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlKSB7XG5cbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7fSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG5cbiAgICAgIHNjb3BlLml0ZW1zID0gW1xuICAgICAgICB7IGxhYmVsOiAnTmV3IFJlc291cmNlcycsIHN0YXRlOiAnbmV3UmVzb3VyY2VzJyB9LFxuICAgICAgICB7IGxhYmVsOiAnTmV3IEd1aWRlcycsIHN0YXRlOiAnbmV3R3VpZGVzJyB9LFxuICAgICAgICB7IGxhYmVsOiAnUGVvcGxlJywgc3RhdGU6ICdzZWFyY2hQZW9wbGUnfVxuXG4gICAgICBdO1xuXG4gICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpO1xuICAgICAgfTtcblxuICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgdmFyIHNldFVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIHZhciByZW1vdmVVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgIH07XG5cbiAgICAgIHNldFVzZXIoKTtcblxuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG4gICAgfVxuXG4gIH07XG5cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgncmVzb3VyY2VDYXJkJywgZnVuY3Rpb24gKCRzdGF0ZSwgJGxvZywgUmVzb3VyY2VGYWN0b3J5LCBHdWlkZUZhY3RvcnkpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvcmVzb3VyY2UtY2FyZC9yZXNvdXJjZS1jYXJkLmh0bWwnLFxuICAgIHNjb3BlOiB0cnVlLFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG4gICAgICBsZXQgbGlrZWQgPSBzY29wZS51c2VyLnJlc291cmNlTGlrZS5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5pZCA9PT0gc2NvcGUucmVzb3VyY2UuaWQ7XG4gICAgICB9KS5sZW5ndGggPT09IDE7XG5cbiAgICAgIGxldCBkaXNsaWtlZCA9IHNjb3BlLnVzZXIucmVzb3VyY2VEaXNsaWtlLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmlkID09PSBzY29wZS5yZXNvdXJjZS5pZDtcbiAgICAgIH0pLmxlbmd0aCA9PT0gMTtcblxuICAgICAgc2NvcGUubGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgIGlmIChzY29wZS51c2VyLnJlc291cmNlTGlrZS5maWx0ZXIoZnVuY3Rpb24ocmVzb3VyY2Upe1xuICAgICAgICAgIHJldHVybiByZXNvdXJjZS5pZCA9PT0gaWQ7XG4gICAgICAgIH0pLmxlbmd0aCA9PT0gMCAmJiAhbGlrZWQpe1xuICAgICAgICAgIFJlc291cmNlRmFjdG9yeS5saWtlKGlkKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbGlrZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2NvcGUucmVzb3VyY2UubGlrZXMgKz0gMTtcbiAgICAgICAgICAgIGlmIChkaXNsaWtlZCkge1xuICAgICAgICAgICAgICBkaXNsaWtlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBzY29wZS5yZXNvdXJjZS5kaXNsaWtlcyAtPSAxO1xuICAgICAgICAgICAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LnJlbW92ZURpc2xpa2UoaWQsIHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgc2NvcGUuZGlzbGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgIGlmIChzY29wZS51c2VyLnJlc291cmNlRGlzbGlrZS5maWx0ZXIoZnVuY3Rpb24ocmVzb3VyY2Upe1xuICAgICAgICAgIHJldHVybiByZXNvdXJjZS5pZCA9PT0gaWQ7XG4gICAgICAgIH0pLmxlbmd0aCA9PT0gMCAmJiAhZGlzbGlrZWQpe1xuICAgICAgICAgIFJlc291cmNlRmFjdG9yeS5kaXNsaWtlKGlkKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZGlzbGlrZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2NvcGUucmVzb3VyY2UuZGlzbGlrZXMgKz0gMTtcbiAgICAgICAgICAgIGlmIChsaWtlZCkge1xuICAgICAgICAgICAgICBsaWtlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBzY29wZS5yZXNvdXJjZS5saWtlcyAtPSAxO1xuICAgICAgICAgICAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LnJlbW92ZUxpa2UoaWQsIHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBzY29wZS51c2VyR3VpZGVzID0gc2NvcGUudXNlci5ndWlkZXM7XG5cbiAgICAgIHNjb3BlLnNlYXJjaEJ5VGFnID0gZnVuY3Rpb24oaWQsIHRpdGxlKSB7XG4gICAgICAgICRzdGF0ZS5nbygnc2VhcmNoUmVzdWx0cycsIHt0YWdJZHM6IGlkLCB0YWdUaXRsZXM6IHRpdGxlfSk7XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLnNlYXJjaEJ5QXV0aG9yID0gZnVuY3Rpb24oYXV0aG9yTmFtZSkge1xuICAgICAgICAkc3RhdGUuZ28oJ3NlYXJjaEF1dGhvclJlc3VsdHMnLCB7YXV0aG9yTmFtZTogYXV0aG9yTmFtZX0pO1xuICAgICAgfVxuXG4gICAgICBzY29wZS5zZWFyY2hCeVNvdXJjZSA9IGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgICAkc3RhdGUuZ28oJ3NlYXJjaFNvdXJjZVJlc3VsdHMnLCB7c291cmNlOiBzb3VyY2V9KVxuICAgICAgfVxuXG5cdFx0XHRzY29wZS5kZWxldGUgPSBmdW5jdGlvbihpZCl7XG5cdFx0XHRcdGlmIChzY29wZS51c2VyLmlzQWRtaW4pe1xuXHRcdFx0XHRcdFJlc291cmNlRmFjdG9yeS5kZWxldGUoaWQpXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRcdGVsZW1lbnQuaHRtbCgnJyk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG4gICAgICBzY29wZS5yZW1vdmUgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgIGlmIChzY29wZS51c2VyLmlkID09PSBzY29wZS5hdXRob3IuaWQpe1xuICAgICAgICAgIEd1aWRlRmFjdG9yeS5yZW1vdmVSZXNvdXJjZShzY29wZS5ndWlkZS5pZCwge2lkOiBpZH0pXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBlbGVtZW50Lmh0bWwoJycpO1xuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgndGFnQ2hpcHMnLCBmdW5jdGlvbiAoVGFnRmFjdG9yeSwgUmVzb3VyY2VGYWN0b3J5LCAkbG9nKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy90YWctY2hpcHMvdGFnLWNoaXBzLmh0bWwnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgIHNlbGVjdGVkVGFnczogJz0nLFxuICAgICAgICAgIG1hdGNoOiAnPSdcbiAgICAgICAgfSxcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHtcblxuICAgICAgICAgIFRhZ0ZhY3RvcnkuZ2V0QWxsKClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbih0YWdzKXtcbiAgICAgICAgICAgIHZhciBhbGxUYWdzID0gdGFncztcbiAgICAgICAgICAgIHNjb3BlLmFsbFRhZ3MgPSBhbGxUYWdzO1xuXG4gICAgICAgICAgICBzY29wZS5xdWVyeVRhZ3MgPSBmdW5jdGlvbihzZWFyY2gpIHtcbiAgICAgICAgICAgICAgdmFyIGZpcnN0UGFzcyA9IGFsbFRhZ3MuZmlsdGVyKGZ1bmN0aW9uKHRhZyl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhZy50aXRsZS5pbmNsdWRlcyhzZWFyY2gudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHJldHVybiBmaXJzdFBhc3MuZmlsdGVyKGZ1bmN0aW9uKHRhZyl7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzY29wZS5zZWxlY3RlZFRhZ3MubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgICAgICAgaWYgKHRhZy50aXRsZSA9PT0gc2VhcmNoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLnRyYW5zZm9ybUNoaXAgPSBmdW5jdGlvbihjaGlwKSB7XG4gICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzT2JqZWN0KGNoaXApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaXA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSBpZiAoY2hpcCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHRpdGxlOiBjaGlwLnRvTG93ZXJDYXNlKCksIHR5cGU6ICduZXcnIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NvcGUuJHdhdGNoQ29sbGVjdGlvbignc2VsZWN0ZWRUYWdzJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUuYXZhaWxhYmxlVGFncyA9IHNjb3BlLnF1ZXJ5VGFncygnJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcblxuICAgICAgICB9XG4gICAgfTtcbiAgfSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
