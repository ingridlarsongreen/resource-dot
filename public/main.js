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
    controller: 'friendCtrl',
    resolve: {
      friend: function friend(UserFactory, $stateParams) {
        return UserFactory.getById($stateParams.friendId);
      },
      guides: function guides(GuideFactory, $stateParams) {
        return GuideFactory.getByAuthor($stateParams.friendId);
      },
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

app.controller('friendCtrl', function ($scope, $state, UserFactory, friend, guides, user) {
  $scope.user = user;
  $scope.userFriends = $scope.user.friend;
  $scope.userFriendsIds = $scope.userFriends.map(function (userFriend) {
    return userFriend.id;
  });
  $scope.friend = friend;
  $scope.guides = guides;

  $scope.follow = function (friendId) {
    return UserFactory.addFriend($scope.user.id, { friendId: friendId }).then(function () {
      $scope.userFriendsIds.push(friendId);
    });
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
    });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('friends', {
    url: '/:userId/friends/all',
    templateUrl: 'js/friends/friends.html',
    controller: 'friendsCtrl',
    resolve: {
      user: function user(UserFactory, $stateParams) {
        return UserFactory.getById($stateParams.userId);
      }
    }
  });
});

app.controller('friendsCtrl', function ($scope, $state, user) {
  $scope.friends = user.friend;

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
      guide: function guide(GuideFactory, $stateParams) {
        var id = $stateParams.id;
        return GuideFactory.getById(id);
      },
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

app.controller('GuideCtrl', function ($scope, guide, user, GuideFactory, $log, $mdToast) {
  $scope.guide = guide;
  $scope.resources = guide.resources.sort(function (a, b) {
    if (b.order > a.order) {
      return -1;
    }
    if (a.order > b.order) {
      return 1;
    }
    return 0;
  });

  $scope.author = guide.author;
  $scope.user = user;
  $scope.sortableOptions = {};

  $scope.updateOrder = function () {
    var newOrder = $scope.resources.map(function (resource) {
      return resource.id;
    });
    GuideFactory.updateOrder(guide.id, newOrder).then(function () {
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
    controller: 'LikedResourcesCtrl',
    resolve: {
      user: function user(UserFactory, $stateParams) {
        var id = $stateParams.userId;
        return UserFactory.getById(id);
      }
    }
  });
});

app.controller('LikedResourcesCtrl', function ($scope, user) {
  $scope.likedResources = user.resourceLike;
  $scope.user = user;
  $scope.guides = user.guides;
  $scope.data = $scope.likedResources.slice(0, 5);
  $scope.getMoreData = function () {
    $scope.data = $scope.likedResources.slice(0, $scope.data.length + 5);
  };
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
      guides: function guides(GuideFactory) {
        return GuideFactory.getAll();
      },
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

app.controller('newGuidesCtrl', function ($scope, guides, user) {
  $scope.user = user;
  $scope.guides = guides.sort(function (a, b) {
    var dateA = new Date(a.createdAt);
    dateA = Number(dateA);
    var dateB = new Date(b.createdAt);
    dateB = Number(dateB);
    return dateB - dateA;
  }).slice(0, 10);
});

app.config(function ($stateProvider) {
  $stateProvider.state('newResources', {
    url: '/newResources',
    templateUrl: 'js/new_resources/new_resources.html',
    controller: 'newResourcesCtrl',
    resolve: {
      resources: function resources(ResourceFactory) {
        return ResourceFactory.getAll();
      },
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

app.controller('newResourcesCtrl', function ($scope, resources, user) {
  $scope.resources = resources.sort(function (a, b) {
    var dateA = new Date(a.createdAt);
    dateA = Number(dateA);
    var dateB = new Date(b.createdAt);
    dateB = Number(dateB);
    return dateB - dateA;
  }).slice(0, 10);
  $scope.user = user;
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
    controller: 'searchPeopleCtrl',
    resolve: {
      users: function users(UserFactory) {
        return UserFactory.getAll();
      }
    }
  });
});

app.controller('searchPeopleCtrl', function ($scope, $state, users) {
  //$scope.usersbyTag = usersByTag;
  $scope.users = users;
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
      resources: function resources(ResourceFactory, UserFactory, $stateParams, $filter) {
        var tags = $stateParams.tagIds.split('+');
        tags = tags.map(function (id) {
          return +id;
        });
        return ResourceFactory.getAllByTag(tags).then(function (resources) {
          return resources.sort(function (a, b) {
            if (a.netLikes > b.netLikes) {
              return -1;
            }
            if (a.netLikes < b.netLikes) {
              return 1;
            }
            return 0;
          });
        });
      },
      guides: function guides(GuideFactory, $stateParams) {
        var tags = $stateParams.tagIds.split('+');
        tags = tags.map(function (id) {
          return +id;
        });
        return GuideFactory.getAllByTag(tags);
      },
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

app.controller('SearchCtrl', function ($scope, $stateParams, resources, guides, user) {
  $scope.tags = $stateParams.tagTitles.split('+');
  $scope.user = user;
  $scope.resources = resources;
  $scope.data = $scope.resources.slice(0, 5);
  $scope.getMoreData = function () {
    $scope.data = $scope.resources.slice(0, $scope.data.length + 5);
  };
  $scope.guides = guides;
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
    console.log('friendId', friendId);
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
      resources: function resources(ResourceFactory, $stateParams) {
        return ResourceFactory.getAllByAuthor($stateParams.authorName);
      },
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

app.controller('SearchAuthorCtrl', function ($scope, resources, user, $stateParams) {
  $scope.author = $stateParams.authorName;
  $scope.user = user;
  $scope.guides = [];
  $scope.data = resources.slice(0, 5);
  $scope.getMoreData = function () {
    $scope.data = resources.slice(0, $scope.data.length + 5);
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('searchSourceResults', {
    url: '/search_results/source/:source',
    templateUrl: 'js/search_results/search_results.html',
    controller: 'SearchSourceCtrl',
    resolve: {
      resources: function resources(ResourceFactory, $stateParams) {
        return ResourceFactory.getAllBySource($stateParams.source);
      },
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

app.controller('SearchSourceCtrl', function ($scope, resources, user, $stateParams) {
  $scope.source = $stateParams.source;
  $scope.user = user;
  $scope.guides = [];
  $scope.resources = resources;
  $scope.data = $scope.resources.slice(0, 5);
  $scope.getMoreData = function () {
    $scope.data = $scope.resources.slice(0, $scope.data.length + 5);
  };
});

app.directive('addToGuide', function ($mdDialog, $mdToast, GuideFactory, $log) {
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
    }
  };
});

app.directive('guideCard', function (GuideFactory, $state, $log) {
  return {
    restrict: 'E',
    templateUrl: 'js/common/directives/guide-card/guide-card.html',
    scope: true,
    link: function link(scope) {
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
          ResourceFactory.delete(id);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImZyaWVuZC9mcmllbmQuanMiLCJmcmllbmRzL2ZyaWVuZHMuanMiLCJmc2EvZnNhLXByZS1idWlsdC5qcyIsImd1aWRlX2RldGFpbC9ndWlkZS5qcyIsImhvbWUvaG9tZS5qcyIsImxpa2VkX3Jlc291cmNlcy9saWtlZF9yZXNvdXJjZXMuanMiLCJsb2dpbi9sb2dpbi5qcyIsIm5ld19ndWlkZXMvbmV3X2d1aWRlcy5qcyIsIm5ld19yZXNvdXJjZXMvbmV3X3Jlc291cmNlcy5qcyIsInByb2ZpbGUvcHJvZmlsZS5qcyIsInNlYXJjaF9wZW9wbGUvc2VhcmNoX3Blb3BsZS5qcyIsInNlYXJjaF9yZXN1bHRzL3NlYXJjaF9yZXN1bHRzLmpzIiwic2lnbnVwL3NpZ251cC5qcyIsImNvbW1vbi9mYWN0b3JpZXMvZGF0YV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9ndWlkZV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9yZWNvbW1lbmRhdGlvbl9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9yZXNvdXJjZV9mYWN0b3J5LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy90YWdfZmFjdG9yeS5qcyIsImNvbW1vbi9mYWN0b3JpZXMvdXNlcl9mYWN0b3J5LmpzIiwic2VhcmNoX3Jlc3VsdHMvc2VhcmNoX2F1dGhvcl9yZXN1bHRzL3NlYXJjaF9hdXRob3JfcmVzdWx0cy5qcyIsInNlYXJjaF9yZXN1bHRzL3NlYXJjaF9zb3VyY2VfcmVzdWx0cy9zZWFyY2hfc291cmNlX3Jlc3VsdHMuanMiLCJjb21tb24vZGlyZWN0aXZlcy9hZGQtdG8tZ3VpZGUvYWRkLXRvLWd1aWRlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZmFiL2ZhYi5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2d1aWRlLWNhcmQvZ3VpZGUtY2FyZC5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJjb21tb24vZGlyZWN0aXZlcy9yZXNvdXJjZS1jYXJkL3Jlc291cmNlLWNhcmQuanMiLCJjb21tb24vZGlyZWN0aXZlcy90YWctY2hpcHMvdGFnLWNoaXBzLmpzIl0sIm5hbWVzIjpbIndpbmRvdyIsImFwcCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJURVNUSU5HIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwidGVtcGxhdGVVcmwiLCJjb250cm9sbGVyIiwicmVzb2x2ZSIsImZyaWVuZCIsIlVzZXJGYWN0b3J5IiwiJHN0YXRlUGFyYW1zIiwiZ2V0QnlJZCIsImZyaWVuZElkIiwiZ3VpZGVzIiwiR3VpZGVGYWN0b3J5IiwiZ2V0QnlBdXRob3IiLCJpZCIsIiRzY29wZSIsInVzZXJGcmllbmRzIiwidXNlckZyaWVuZHNJZHMiLCJtYXAiLCJ1c2VyRnJpZW5kIiwiZm9sbG93IiwiYWRkRnJpZW5kIiwicHVzaCIsInNlYXJjaCIsInRhZ0lkIiwidGFnSWRzIiwidW5mb2xsb3ciLCJkZWxldGVGcmllbmQiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1c2VySWQiLCJmcmllbmRzIiwiZmluZEZyaWVuZCIsIkVycm9yIiwiZmFjdG9yeSIsImlvIiwib3JpZ2luIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiJHEiLCJBVVRIX0VWRU5UUyIsInN0YXR1c0RpY3QiLCJyZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCIkYnJvYWRjYXN0Iiwic3RhdHVzIiwicmVqZWN0IiwiJGh0dHBQcm92aWRlciIsImludGVyY2VwdG9ycyIsIiRpbmplY3RvciIsImdldCIsInNlcnZpY2UiLCIkaHR0cCIsIlNlc3Npb24iLCJvblN1Y2Nlc3NmdWxMb2dpbiIsImNyZWF0ZSIsImZyb21TZXJ2ZXIiLCJjYXRjaCIsImxvZ2luIiwiY3JlZGVudGlhbHMiLCJwb3N0IiwibWVzc2FnZSIsImxvZ291dCIsImRlc3Ryb3kiLCJzaWdudXAiLCJzaWduVXBJbmZvIiwic2VsZiIsImd1aWRlIiwiJGxvZyIsIiRtZFRvYXN0IiwicmVzb3VyY2VzIiwic29ydCIsImEiLCJiIiwib3JkZXIiLCJhdXRob3IiLCJzb3J0YWJsZU9wdGlvbnMiLCJ1cGRhdGVPcmRlciIsIm5ld09yZGVyIiwicmVzb3VyY2UiLCJzaG93Iiwic2ltcGxlIiwidGV4dENvbnRlbnQiLCIkZmlsdGVyIiwiVGFnRmFjdG9yeSIsIlJlc291cmNlRmFjdG9yeSIsInNlbGVjdGVkVGFncyIsInRhZ3MiLCJ0YWciLCJ0YWdUaXRsZXMiLCJ0aXRsZSIsImpvaW4iLCJsaWtlZFJlc291cmNlcyIsInJlc291cmNlTGlrZSIsInNsaWNlIiwiZ2V0TW9yZURhdGEiLCJsZW5ndGgiLCJzZW5kTG9naW4iLCJsb2dpbkluZm8iLCJnZXRBbGwiLCJkYXRlQSIsIkRhdGUiLCJjcmVhdGVkQXQiLCJOdW1iZXIiLCJkYXRlQiIsIlJlY29tbWVuZGF0aW9uRmFjdG9yeSIsImxvYWRlZCIsInNodWZmbGVBcnJheSIsImFycmF5IiwiaSIsImoiLCJNYXRoIiwiZmxvb3IiLCJyYW5kb20iLCJ0ZW1wIiwiZnVsbFVzZXIiLCJub0d1aWRlcyIsImZldGNoUmVzb3VyY2VzIiwibm9UYWdzIiwiJHdhdGNoQ29sbGVjdGlvbiIsIl8iLCJkZWJvdW5jZSIsInVwZGF0ZVBhZ2UiLCJ1cGRhdGVUYWdzIiwidXBkYXRlZFRhZ3MiLCJnZXRBbGxCeVRhZyIsIm9iaiIsImdldEJ5VGFncyIsInVzZXJzIiwic3VnZ2VzdGVkRnJpZW5kcyIsInNldFRhZ3MiLCJmaW5kRnJpZW5kcyIsInZpZXdMaWtlZFJlc291cmNlcyIsInNwbGl0IiwibmV0TGlrZXMiLCJ1c2VyR3VpZGVzIiwiY2hlY2tJbmZvIiwic2VuZFNpZ25VcCIsInBhc3N3b3JkIiwicGFzc3dvcmRDb25maXJtIiwiYWxsVGFncyIsInF1ZXJ5VGFncyIsImZpcnN0UGFzcyIsImZpbHRlciIsImluY2x1ZGVzIiwidG9Mb3dlckNhc2UiLCJhZGRUYWciLCJncm91cCIsImF2YWlsYWJsZVRhZ3MiLCJEYXRhRmFjdG9yeSIsImdldERhdGEiLCJhcmd1bWVudHMiLCJhdXRob3JJZCIsImFkZE5ld0d1aWRlIiwiYWRkUmVzb3VyY2UiLCJwdXQiLCJyZW1vdmVSZXNvdXJjZSIsImxpa2UiLCJkaXNsaWtlIiwicmVtb3ZlTGlrZSIsImRlbGV0ZSIsInJlbW92ZURpc2xpa2UiLCJpbnRlcnNlY3QiLCJhaSIsImJpIiwicmVzdWx0IiwiY29tcGFyZSIsInJhdGluZyIsInNodWZmbGUiLCJjb3B5IiwibiIsImN1cnJlbnRVc2VyIiwicmVjb21tZW5kZWQiLCJzaHVmZmxlR3JvdXAiLCJmb3JFYWNoIiwiY3VycmVudFJhdGluZyIsImxpa2VVc2VyIiwiZGlzbGlrZVVzZXIiLCJjb25jYXQiLCJnZXRBbGxCeVR5cGUiLCJ0eXBlIiwiZ2V0QWxsQnlBdXRob3IiLCJnZXRBbGxCeVNvdXJjZSIsInNvdXJjZSIsInJlcGxhY2UiLCJhZGRVc2VyIiwibG9nIiwiYXV0aG9yTmFtZSIsImRpcmVjdGl2ZSIsIiRtZERpYWxvZyIsInJlc3RyaWN0Iiwic2NvcGUiLCJsaW5rIiwib3BlblBhbmVsIiwibmV3R3VpZGUiLCJvcGVuVG9hc3QiLCJzaG93QWR2YW5jZWQiLCJwcmVzZXJ2ZVNjb3BlIiwiY2xpY2tPdXRzaWRlVG9DbG9zZSIsImVzY2FwZVRvQ2xvc2UiLCJjbGVhckZvcm0iLCJndWlkZUZvcm0iLCIkc2V0UHJpc3RpbmUiLCIkc2V0VW50b3VjaGVkIiwic3VibWl0Rm9ybSIsImhpZGUiLCJkZXNjcmlwdGlvbiIsInR5cGVzIiwiZ2V0R3VpZGVzIiwibG9nZ2VkSW4iLCJjbGVhckd1aWRlcyIsInNob3dEaWFsb2ciLCJjb250ZW50RWxlbWVudCIsInBhcmVudCIsImVsZW1lbnQiLCJkb2N1bWVudCIsImJvZHkiLCJyZXNvdXJjZUZvcm0iLCJjcmVhdGVkIiwiJGludmFsaWQiLCIkdmFsaWQiLCJndWlkZUlkIiwibGlrZWQiLCJndWlkZUxpa2UiLCJpdGVtIiwiZGlzbGlrZWQiLCJndWlkZURpc2xpa2UiLCJsaWtlcyIsImRpc2xpa2VzIiwiaXRlbXMiLCJsYWJlbCIsImlzTG9nZ2VkSW4iLCJzZXRVc2VyIiwicmVtb3ZlVXNlciIsInJlc291cmNlRGlzbGlrZSIsInNlYXJjaEJ5VGFnIiwic2VhcmNoQnlBdXRob3IiLCJzZWFyY2hCeVNvdXJjZSIsImlzQWRtaW4iLCJyZW1vdmUiLCJodG1sIiwibWF0Y2giLCJ0cmFuc2Zvcm1DaGlwIiwiY2hpcCIsImlzT2JqZWN0Il0sIm1hcHBpbmdzIjoiQUFBQTs7OztBQUNBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxFQUFBLFlBQUEsRUFBQSxpQkFBQSxFQUFBLGFBQUEsQ0FBQSxDQUFBOztBQUVBLElBQUEsQ0FBQUgsT0FBQUksT0FBQSxFQUFBO0FBQ0E7QUFDQUgsTUFBQUksTUFBQSxDQUFBLFVBQUFDLGtCQUFBLEVBQUFDLGlCQUFBLEVBQUE7QUFDQTtBQUNBQSxzQkFBQUMsU0FBQSxDQUFBLElBQUE7QUFDQTtBQUNBRix1QkFBQUcsU0FBQSxD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QyxNQUFBLEtBQUEsRUFBQTtBQUNBO0FBQ0EsU0FQQTs7QUFTQVcsY0FBQXhFLGdCQUFBLENBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQXdFLGdCQUFBM0MsYUFBQSxHQUFBMkMsTUFBQWxELFNBQUEsQ0FBQSxFQUFBLENBQUE7QUFDQSxTQUZBO0FBR0EsT0E5QkEsRUErQkFwRixLQS9CQSxDQStCQVcsS0FBQXRGLEtBL0JBO0FBaUNBO0FBMUNBLEdBQUE7QUE0Q0EsQ0E3Q0EiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnRnVsbHN0YWNrR2VuZXJhdGVkQXBwJywgWydmc2FQcmVCdWlsdCcsICd1aS5yb3V0ZXInLCAndWkuYm9vdHN0cmFwJywgJ25nQW5pbWF0ZScsICduZ01hdGVyaWFsJywgJ2luZmluaXRlLXNjcm9sbCcsICd1aS5zb3J0YWJsZSddKTtcblxuaWYgKCF3aW5kb3cuVEVTVElORykge1xuICAgIC8vIFdoeSB3ZSBkb24ndCB3YW50IHRoaXMgYmxvY2sgdG8gcnVuIGlmIHdlJ3JlIGluIHRoZSB0ZXN0aW5nIG1vZGU6IHRoaXMgYmxvY2sgbWFrZXMgcmUtcm91dGVzIHRoZSBwYWdlIHRvIGhvbWUgcGFnZSAoJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpKTsgdGhpcyBhZGRpdGlvbmFsIHJlcXVlc3QgZG9lc24ndCBnZXQgaGFuZGxlZCBpbiB0aGUgZnJvbnQtZW5kIHRlc3RpbmcgZmlsZXMtLXRoZSBmcm9udC1lbmQgdGVzdHMgd2lsbCB0aGluayB0aGF0IHRoZXkgZmFpbGVkXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgICAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAgICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbiAgICAgICAgLy8gVHJpZ2dlciBwYWdlIHJlZnJlc2ggd2hlbiBhY2Nlc3NpbmcgYW4gT0F1dGggcm91dGVcbiAgICAgICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGxpc3RlbmluZyB0byBlcnJvcnMgYnJvYWRjYXN0ZWQgYnkgdWktcm91dGVyLCB1c3VhbGx5IG9yaWdpbmF0aW5nIGZyb20gcmVzb2x2ZXNcbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlRXJyb3InLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zLCBmcm9tU3RhdGUsIGZyb21QYXJhbXMsIHRocm93bkVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhgVGhlIGZvbGxvd2luZyBlcnJvciB3YXMgdGhyb3duIGJ5IHVpLXJvdXRlciB3aGlsZSB0cmFuc2l0aW9uaW5nIHRvIHN0YXRlIFwiJHt0b1N0YXRlLm5hbWV9XCIuIFRoZSBvcmlnaW4gb2YgdGhpcyBlcnJvciBpcyBwcm9iYWJseSBhIHJlc29sdmUgZnVuY3Rpb246YCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IodGhyb3duRXJyb3IpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdmcmllbmQnLCB7XG4gICAgICB1cmw6ICcvZnJpZW5kcy86ZnJpZW5kSWQnLFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy9mcmllbmQvZnJpZW5kLmh0bWwnLFxuICAgICAgY29udHJvbGxlcjogJ2ZyaWVuZEN0cmwnLFxuICAgICAgcmVzb2x2ZToge1xuICAgICAgICBmcmllbmQ6IGZ1bmN0aW9uKFVzZXJGYWN0b3J5LCAkc3RhdGVQYXJhbXMpIHtcbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCgkc3RhdGVQYXJhbXMuZnJpZW5kSWQpO1xuICAgICAgICB9LFxuICAgICAgICBndWlkZXM6IGZ1bmN0aW9uKEd1aWRlRmFjdG9yeSwgJHN0YXRlUGFyYW1zKSB7XG4gICAgICAgICAgcmV0dXJuIEd1aWRlRmFjdG9yeS5nZXRCeUF1dGhvcigkc3RhdGVQYXJhbXMuZnJpZW5kSWQpO1xuICAgICAgICB9LFxuICAgICAgICB1c2VyOiBmdW5jdGlvbihBdXRoU2VydmljZSwgVXNlckZhY3Rvcnkpe1xuICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgICAgaWYgKCF1c2VyKXtcbiAgICAgICAgICAgICAgcmV0dXJuIHtpZDogMCwgbmFtZTogJ0d1ZXN0J31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ2ZyaWVuZEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRzdGF0ZSwgVXNlckZhY3RvcnksIGZyaWVuZCwgZ3VpZGVzLCB1c2VyKSB7XG4gICRzY29wZS51c2VyID0gdXNlcjtcbiAgJHNjb3BlLnVzZXJGcmllbmRzID0gJHNjb3BlLnVzZXIuZnJpZW5kO1xuICAkc2NvcGUudXNlckZyaWVuZHNJZHMgPSAkc2NvcGUudXNlckZyaWVuZHMubWFwKGZ1bmN0aW9uKHVzZXJGcmllbmQpIHtcbiAgICByZXR1cm4gdXNlckZyaWVuZC5pZDtcbiAgfSlcbiAgJHNjb3BlLmZyaWVuZCA9IGZyaWVuZDtcbiAgJHNjb3BlLmd1aWRlcyA9IGd1aWRlcztcblxuICAkc2NvcGUuZm9sbG93ID0gZnVuY3Rpb24oZnJpZW5kSWQpIHtcbiAgICByZXR1cm4gVXNlckZhY3RvcnkuYWRkRnJpZW5kKCRzY29wZS51c2VyLmlkLCB7ZnJpZW5kSWQ6IGZyaWVuZElkfSlcbiAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICRzY29wZS51c2VyRnJpZW5kc0lkcy5wdXNoKGZyaWVuZElkKTtcbiAgICB9KVxuICB9XG5cbiAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKHRhZ0lkKSB7XG4gICAgJHN0YXRlLmdvKCdzZWFyY2hSZXN1bHRzJywge3RhZ0lkczogdGFnSWR9KTtcbiAgfTtcblxuICAkc2NvcGUudW5mb2xsb3cgPSBmdW5jdGlvbihmcmllbmRJZCkge1xuICAgIHJldHVybiBVc2VyRmFjdG9yeS5kZWxldGVGcmllbmQoJHNjb3BlLnVzZXIuaWQsIGZyaWVuZElkKVxuICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGluZGV4ID0gJHNjb3BlLnVzZXJGcmllbmRzSWRzLmluZGV4T2YoZnJpZW5kSWQpO1xuICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgJHNjb3BlLnVzZXJGcmllbmRzSWRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfSlcbiAgfVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnZnJpZW5kcycsIHtcbiAgICAgIHVybDogJy86dXNlcklkL2ZyaWVuZHMvYWxsJyxcbiAgICAgIHRlbXBsYXRlVXJsOiAnanMvZnJpZW5kcy9mcmllbmRzLmh0bWwnLFxuICAgICAgY29udHJvbGxlcjogJ2ZyaWVuZHNDdHJsJyxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgdXNlcjogZnVuY3Rpb24oVXNlckZhY3RvcnksICRzdGF0ZVBhcmFtcykge1xuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKCRzdGF0ZVBhcmFtcy51c2VySWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdmcmllbmRzQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCB1c2VyKSB7XG4gICRzY29wZS5mcmllbmRzID0gdXNlci5mcmllbmQ7XG5cbiAgJHNjb3BlLmZpbmRGcmllbmQgPSBmdW5jdGlvbihmcmllbmRJZCkge1xuICAgICRzdGF0ZS5nbygnZnJpZW5kJywge2ZyaWVuZElkOiBmcmllbmRJZH0pO1xuICB9O1xufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZnNhUHJlQnVpbHQnLCBbXSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIHVzZXIgPSByZXNwb25zZS5kYXRhLnVzZXI7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZSh1c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zaWdudXAgPSBmdW5jdGlvbihzaWduVXBJbmZvKXtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvc2lnbnVwJywgc2lnblVwSW5mbylcbiAgICAgICAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHsgbWVzc2FnZTogJ0ludmFsaWQgc2lnbnVwIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSgpKTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2d1aWRlRGV0YWlsJywge1xuICAgIHVybDogJy9ndWlkZS86aWQnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvZ3VpZGVfZGV0YWlsL2d1aWRlLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICdHdWlkZUN0cmwnLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGd1aWRlOiBmdW5jdGlvbihHdWlkZUZhY3RvcnksICRzdGF0ZVBhcmFtcyl7XG4gICAgICAgIGxldCBpZCA9ICRzdGF0ZVBhcmFtcy5pZFxuICAgICAgICByZXR1cm4gR3VpZGVGYWN0b3J5LmdldEJ5SWQoaWQpO1xuICAgICAgfSxcbiAgICAgIHVzZXI6IGZ1bmN0aW9uKEF1dGhTZXJ2aWNlLCBVc2VyRmFjdG9yeSl7XG4gICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICBpZiAoIXVzZXIpe1xuICAgICAgICAgICAgcmV0dXJuIHtpZDogMCwgbmFtZTogJ0d1ZXN0J31cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5SWQodXNlci5pZCk7XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9KVxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdHdWlkZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIGd1aWRlLCB1c2VyLCBHdWlkZUZhY3RvcnksICRsb2csICRtZFRvYXN0KSB7XG4gICRzY29wZS5ndWlkZSA9IGd1aWRlO1xuICAkc2NvcGUucmVzb3VyY2VzID0gZ3VpZGUucmVzb3VyY2VzLnNvcnQoZnVuY3Rpb24oYSwgYil7XG4gICAgaWYgKGIub3JkZXIgPiBhLm9yZGVyKSB7XG4gICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICBpZiAoYS5vcmRlciA+IGIub3JkZXIpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfSk7XG5cbiAgJHNjb3BlLmF1dGhvciA9IGd1aWRlLmF1dGhvcjtcbiAgJHNjb3BlLnVzZXIgPSB1c2VyXG4gICRzY29wZS5zb3J0YWJsZU9wdGlvbnMgPSB7fTtcblxuICAkc2NvcGUudXBkYXRlT3JkZXIgPSBmdW5jdGlvbigpe1xuICAgIHZhciBuZXdPcmRlciA9ICRzY29wZS5yZXNvdXJjZXMubWFwKGZ1bmN0aW9uKHJlc291cmNlKXtcbiAgICAgICAgcmV0dXJuIHJlc291cmNlLmlkO1xuICAgIH0pO1xuICAgIEd1aWRlRmFjdG9yeS51cGRhdGVPcmRlcihndWlkZS5pZCwgbmV3T3JkZXIpXG4gICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKClcbiAgICAgICAgICAgICAgICAgICAgLnRleHRDb250ZW50KCdHdWlkZSB1cGRhdGVkIScpKTtcbiAgICB9KVxuICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgfTtcbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0hvbWVDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkZmlsdGVyLCBUYWdGYWN0b3J5LCBSZXNvdXJjZUZhY3RvcnksICRzdGF0ZSkge1xuICAkc2NvcGUuc2VsZWN0ZWRUYWdzID0gW107XG5cbiAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0YWdzID0gJHNjb3BlLnNlbGVjdGVkVGFncy5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICByZXR1cm4gdGFnLmlkO1xuICAgIH0pO1xuXG4gICAgdmFyIHRhZ1RpdGxlcyA9ICRzY29wZS5zZWxlY3RlZFRhZ3MubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgcmV0dXJuIHRhZy50aXRsZTtcbiAgICB9KTtcblxuICAgIHRhZ1RpdGxlcyA9IHRhZ1RpdGxlcy5qb2luKCcrJyk7XG4gICAgdGFncyA9IHRhZ3Muam9pbignKycpO1xuICAgICRzdGF0ZS5nbygnc2VhcmNoUmVzdWx0cycsIHt0YWdJZHM6IHRhZ3MsIHRhZ1RpdGxlczogdGFnVGl0bGVzfSk7XG4gIH07XG59KTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnaG9tZScsIHtcbiAgICAgICAgdXJsOiAnLycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvaG9tZS9ob21lLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbGlrZWRSZXNvdXJjZXMnLCB7XG4gICAgICB1cmw6ICcvcHJvZmlsZS86dXNlcklkL2xpa2VkJyxcbiAgICAgIHRlbXBsYXRlVXJsOiAnanMvbGlrZWRfcmVzb3VyY2VzL2xpa2VkX3Jlc291cmNlcy5odG1sJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdMaWtlZFJlc291cmNlc0N0cmwnLFxuICAgICAgcmVzb2x2ZToge1xuICAgICAgICB1c2VyOiBmdW5jdGlvbihVc2VyRmFjdG9yeSwgJHN0YXRlUGFyYW1zKXtcbiAgICAgICAgICBsZXQgaWQgPSAkc3RhdGVQYXJhbXMudXNlcklkO1xuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKGlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMaWtlZFJlc291cmNlc0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsIHVzZXIpIHtcbiAgICAkc2NvcGUubGlrZWRSZXNvdXJjZXMgPSB1c2VyLnJlc291cmNlTGlrZTtcbiAgICAkc2NvcGUudXNlciA9IHVzZXI7XG4gICAgJHNjb3BlLmd1aWRlcyA9IHVzZXIuZ3VpZGVzO1xuICAgICRzY29wZS5kYXRhID0gJHNjb3BlLmxpa2VkUmVzb3VyY2VzLnNsaWNlKDAsIDUpO1xuICAgICRzY29wZS5nZXRNb3JlRGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICRzY29wZS5kYXRhID0gJHNjb3BlLmxpa2VkUmVzb3VyY2VzLnNsaWNlKDAsICRzY29wZS5kYXRhLmxlbmd0aCArIDUpXG4gICAgfVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICB9KTtcblxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbmV3R3VpZGVzJywge1xuICAgIHVybDogJy9uZXdHdWlkZXMnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvbmV3X2d1aWRlcy9uZXdfZ3VpZGVzLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICduZXdHdWlkZXNDdHJsJyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBndWlkZXM6IGZ1bmN0aW9uKEd1aWRlRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gR3VpZGVGYWN0b3J5LmdldEFsbCgpO1xuICAgICAgfSxcbiAgICB1c2VyOiBmdW5jdGlvbihBdXRoU2VydmljZSwgVXNlckZhY3Rvcnkpe1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgICAgaWYgKCF1c2VyKXtcbiAgICAgICAgICAgIHJldHVybiB7aWQ6IDAsIG5hbWU6ICdHdWVzdCd9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ25ld0d1aWRlc0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsIGd1aWRlcywgdXNlcikge1xuICAkc2NvcGUudXNlciA9IHVzZXI7XG4gICRzY29wZS5ndWlkZXMgPSBndWlkZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgdmFyIGRhdGVBID0gbmV3IERhdGUoYS5jcmVhdGVkQXQpO1xuICAgIGRhdGVBID0gTnVtYmVyKGRhdGVBKTtcbiAgICB2YXIgZGF0ZUIgPSBuZXcgRGF0ZShiLmNyZWF0ZWRBdCk7XG4gICAgZGF0ZUIgPSBOdW1iZXIoZGF0ZUIpO1xuICAgIHJldHVybiBkYXRlQiAtIGRhdGVBO1xuICB9KS5zbGljZSgwLCAxMCk7XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ25ld1Jlc291cmNlcycsIHtcbiAgICB1cmw6ICcvbmV3UmVzb3VyY2VzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL25ld19yZXNvdXJjZXMvbmV3X3Jlc291cmNlcy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnbmV3UmVzb3VyY2VzQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgcmVzb3VyY2VzOiBmdW5jdGlvbihSZXNvdXJjZUZhY3RvcnkpIHtcbiAgICAgICAgcmV0dXJuIFJlc291cmNlRmFjdG9yeS5nZXRBbGwoKTtcbiAgICAgIH0sXG4gICAgdXNlcjogZnVuY3Rpb24oQXV0aFNlcnZpY2UsIFVzZXJGYWN0b3J5KXtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgIGlmICghdXNlcil7XG4gICAgICAgICAgICByZXR1cm4ge2lkOiAwLCBuYW1lOiAnR3Vlc3QnfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCduZXdSZXNvdXJjZXNDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCByZXNvdXJjZXMsIHVzZXIpIHtcbiAgJHNjb3BlLnJlc291cmNlcyA9IHJlc291cmNlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICB2YXIgZGF0ZUEgPSBuZXcgRGF0ZShhLmNyZWF0ZWRBdCk7XG4gICAgZGF0ZUEgPSBOdW1iZXIoZGF0ZUEpO1xuICAgIHZhciBkYXRlQiA9IG5ldyBEYXRlKGIuY3JlYXRlZEF0KTtcbiAgICBkYXRlQiA9IE51bWJlcihkYXRlQik7XG4gICAgcmV0dXJuIGRhdGVCIC0gZGF0ZUE7XG4gIH0pLnNsaWNlKDAsIDEwKTtcbiAgJHNjb3BlLnVzZXIgPSB1c2VyO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncHJvZmlsZScsIHtcbiAgICAgIHVybDogJy9wcm9maWxlJyxcbiAgICAgIGNvbnRyb2xsZXI6ICdQcm9maWxlQ3RybCcsXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL3Byb2ZpbGUvcHJvZmlsZS5odG1sJ1xuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignUHJvZmlsZUN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUsIFRhZ0ZhY3RvcnksIFVzZXJGYWN0b3J5LCBBdXRoU2VydmljZSwgJGxvZywgUmVzb3VyY2VGYWN0b3J5LCBSZWNvbW1lbmRhdGlvbkZhY3RvcnksIEd1aWRlRmFjdG9yeSkge1xuICAkc2NvcGUubG9hZGVkID0gZmFsc2U7XG4gICRzY29wZS5zZWxlY3RlZFRhZ3MgPSBbXTtcbiAgJHNjb3BlLnVzZXIgPSB7fTtcblxuICBmdW5jdGlvbiBzaHVmZmxlQXJyYXkoYXJyYXkpIHtcbiAgICBmb3IgKHZhciBpID0gYXJyYXkubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgICB2YXIgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChpICsgMSkpO1xuICAgICAgICB2YXIgdGVtcCA9IGFycmF5W2ldO1xuICAgICAgICBhcnJheVtpXSA9IGFycmF5W2pdO1xuICAgICAgICBhcnJheVtqXSA9IHRlbXA7XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbiAgfVxuXG4gIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gIC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgfSlcbiAgLnRoZW4oZnVuY3Rpb24oZnVsbFVzZXIpe1xuICAgICRzY29wZS51c2VyID0gZnVsbFVzZXI7IC8vIGdldHMgY3VycmVudCB1c2VyXG4gICAgJHNjb3BlLnNlbGVjdGVkVGFncyA9IGZ1bGxVc2VyLnRhZ3M7IC8vIGdldHMgdXNlcidzIHRhZ3MgKHRvcGljcyB1c2VyIGlzIGludGVyZXN0ZWQgaW4pXG4gICAgJHNjb3BlLmZyaWVuZHMgPSBzaHVmZmxlQXJyYXkoJHNjb3BlLnVzZXIuZnJpZW5kKS5zbGljZSgwLCA0KTtcbiAgICByZXR1cm4gR3VpZGVGYWN0b3J5LmdldEJ5QXV0aG9yKCRzY29wZS51c2VyLmlkKVxuICB9KVxuICAudGhlbihmdW5jdGlvbihndWlkZXMpIHtcbiAgICAkc2NvcGUuZ3VpZGVzID0gZ3VpZGVzO1xuICAgICRzY29wZS5ub0d1aWRlcyA9ICRzY29wZS5ndWlkZXMubGVuZ3RoID09PSAwO1xuICAgIGlmICgkc2NvcGUuc2VsZWN0ZWRUYWdzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZldGNoUmVzb3VyY2VzKCRzY29wZS5zZWxlY3RlZFRhZ3MpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgJHNjb3BlLm5vVGFncyA9IHRydWU7XG4gICAgfVxuICB9KVxuICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAkc2NvcGUubG9hZGVkID0gdHJ1ZTtcbiAgICAkc2NvcGUuJHdhdGNoQ29sbGVjdGlvbignc2VsZWN0ZWRUYWdzJywgZnVuY3Rpb24oKSB7XG4gICAgICBfLmRlYm91bmNlKHVwZGF0ZVBhZ2UsIDEwMDApKCk7XG4gICAgfSk7XG4gIH0pXG4gIC5jYXRjaCgkbG9nLmVycm9yKTtcblxuICBmdW5jdGlvbiB1cGRhdGVQYWdlKCkge1xuICAgIHVwZGF0ZVRhZ3MoKVxuICAgIC50aGVuKGZ1bmN0aW9uKHRhZ3Mpe1xuICAgICAgaWYgKCRzY29wZS5zZWxlY3RlZFRhZ3MubGVuZ3RoKSB7XG4gICAgICAgICRzY29wZS5ub1RhZ3MgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZldGNoUmVzb3VyY2VzKHRhZ3MpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgICRzY29wZS5ub1RhZ3MgPSB0cnVlO1xuICAgICAgICAkc2NvcGUucmVzb3VyY2VzID0gW107XG4gICAgICB9XG4gICAgfSlcbiAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gIH1cblxuICAvLyBwcm9maWxlIHBhZ2UgZGlzcGxheXM6IHJlY29tbWVuZGVkIHJlc291cmNlcywgZ3VpZGVzIGNyZWF0ZWQgYnkgdGhlIHVzZXIsIHVzZXIncyBwaWN0dXJlICYgYWNjb3VudCBzZXR0aW5ncywgJiB1c2VyJ3MgZnJpZW5kc1xuICBmdW5jdGlvbiBmZXRjaFJlc291cmNlcyh1cGRhdGVkVGFncykge1xuICAgIHZhciB0YWdzID0gdXBkYXRlZFRhZ3MubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgcmV0dXJuICt0YWcuaWQ7XG4gICAgfSk7XG4gICAgcmV0dXJuIFJlc291cmNlRmFjdG9yeS5nZXRBbGxCeVRhZyh0YWdzKVxuICAgIC50aGVuKGZ1bmN0aW9uKHJlc291cmNlcykge1xuICAgICAgJHNjb3BlLnJlc291cmNlcyA9IFJlY29tbWVuZGF0aW9uRmFjdG9yeS5nZXQocmVzb3VyY2VzLCAkc2NvcGUudXNlcilcbiAgICAgIC5tYXAob2JqID0+IG9iai5yZXNvdXJjZSkuc2xpY2UoMCwgNSk7XG4gICAgfSlcbiAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5VGFncyh0YWdzKVxuICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcnMpe1xuICAgICAgICBpZiAodXNlcnMubGVuZ3RoID4gMCl7XG4gICAgICAgICAgdmFyIHN1Z2dlc3RlZEZyaWVuZHMgPVtdOyAgXG4gICAgICAgICAgJHNjb3BlLnVzZXJGcmllbmRzSWRzID0gJHNjb3BlLnVzZXIuZnJpZW5kLm1hcChmdW5jdGlvbihmcmllbmQpe1xuICAgICAgICAgICAgcmV0dXJuICtmcmllbmQuaWRcbiAgICAgICAgICB9KVxuICAgICAgICAgIHVzZXJzLm1hcChmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICAgIGlmICgkc2NvcGUudXNlckZyaWVuZHNJZHMuaW5kZXhPZih1c2VyLmlkKSA9PT0gLTEgJiYgJHNjb3BlLnVzZXIuaWQgIT09IHVzZXIuaWQpe1xuICAgICAgICAgICAgICBzdWdnZXN0ZWRGcmllbmRzLnB1c2godXNlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAkc2NvcGUuc3VnZ2VzdGVkRnJpZW5kcyA9IHNodWZmbGVBcnJheShzdWdnZXN0ZWRGcmllbmRzKS5zbGljZSgwLDQpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG4gICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICB9XG5cblxuICBmdW5jdGlvbiB1cGRhdGVUYWdzKCkge1xuICAgIHZhciB0YWdzID0gJHNjb3BlLnNlbGVjdGVkVGFncy5tYXAoZnVuY3Rpb24odGFnKXtcbiAgICAgIGlmICh0eXBlb2YgdGFnID09PSAnb2JqZWN0JykgcmV0dXJuIHRhZy50aXRsZTtcbiAgICAgIGVsc2UgcmV0dXJuIHRhZztcbiAgICB9KTtcbiAgICByZXR1cm4gVXNlckZhY3Rvcnkuc2V0VGFncygkc2NvcGUudXNlci5pZCwgdGFncylcbiAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gIH1cblxuICAkc2NvcGUuZmluZEZyaWVuZCA9IGZ1bmN0aW9uKGZyaWVuZElkKSB7XG4gICAgJHN0YXRlLmdvKCdmcmllbmQnLCB7ZnJpZW5kSWQ6IGZyaWVuZElkfSk7XG4gIH07XG5cbiAgJHNjb3BlLmZpbmRGcmllbmRzID0gZnVuY3Rpb24odXNlcklkKSB7XG4gICAgJHN0YXRlLmdvKCdmcmllbmRzJywge3VzZXJJZDogdXNlcklkfSk7XG4gIH1cblxuICAkc2NvcGUudmlld0xpa2VkUmVzb3VyY2VzID0gZnVuY3Rpb24oKSB7XG4gICAgJHN0YXRlLmdvKCdsaWtlZFJlc291cmNlcycsIHt1c2VySWQ6ICRzY29wZS51c2VyLmlkfSk7XG4gIH1cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2VhcmNoUGVvcGxlJywge1xuICAgICAgdXJsOiAnL3NlYXJjaF9wZW9wbGUnLFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zZWFyY2hfcGVvcGxlL3NlYXJjaF9wZW9wbGUuaHRtbCcsXG4gICAgICBjb250cm9sbGVyOiAnc2VhcmNoUGVvcGxlQ3RybCcsXG4gICAgICByZXNvbHZlOiB7XG4gICAgICB1c2VyczogZnVuY3Rpb24oVXNlckZhY3RvcnkpIHtcbiAgICAgIFx0cmV0dXJuIFVzZXJGYWN0b3J5LmdldEFsbCgpXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignc2VhcmNoUGVvcGxlQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCB1c2Vycykge1xuICAvLyRzY29wZS51c2Vyc2J5VGFnID0gdXNlcnNCeVRhZztcbiAgJHNjb3BlLnVzZXJzID0gdXNlcnNcbiAgJHNjb3BlLmZpbmRGcmllbmQgPSBmdW5jdGlvbih1c2VySWQpe1xuICAgICRzdGF0ZS5nbygnZnJpZW5kJywge2ZyaWVuZElkOiB1c2VySWR9KVxuICB9XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3NlYXJjaFJlc3VsdHMnLCB7XG4gICAgdXJsOiAnL3NlYXJjaF9yZXN1bHRzL3RhZ3MvOnRhZ0lkcy86dGFnVGl0bGVzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3NlYXJjaF9yZXN1bHRzL3NlYXJjaF9yZXN1bHRzLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICdTZWFyY2hDdHJsJyxcbiAgICByZXNvbHZlOiB7XG4gICAgICByZXNvdXJjZXM6IGZ1bmN0aW9uKFJlc291cmNlRmFjdG9yeSwgVXNlckZhY3RvcnksICRzdGF0ZVBhcmFtcywgJGZpbHRlcikge1xuICAgICAgICBsZXQgdGFncyA9ICRzdGF0ZVBhcmFtcy50YWdJZHMuc3BsaXQoJysnKTtcbiAgICAgICAgdGFncyA9IHRhZ3MubWFwKGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgcmV0dXJuICtpZDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlUYWcodGFncylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzb3VyY2VzKXtcbiAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzLnNvcnQoZnVuY3Rpb24oYSwgYil7XG4gICAgICAgICAgICBpZiAoYS5uZXRMaWtlcyA+IGIubmV0TGlrZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGEubmV0TGlrZXMgPCBiLm5ldExpa2VzKSB7XG4gICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGd1aWRlczogZnVuY3Rpb24oR3VpZGVGYWN0b3J5LCAkc3RhdGVQYXJhbXMpe1xuICAgICAgICBsZXQgdGFncyA9ICRzdGF0ZVBhcmFtcy50YWdJZHMuc3BsaXQoJysnKTtcbiAgICAgICAgICB0YWdzID0gdGFncy5tYXAoZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgICByZXR1cm4gK2lkO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEd1aWRlRmFjdG9yeS5nZXRBbGxCeVRhZyh0YWdzKTtcbiAgICAgIH0sXG4gICAgICB1c2VyOiBmdW5jdGlvbihBdXRoU2VydmljZSwgVXNlckZhY3Rvcnkpe1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgICAgaWYgKCF1c2VyKXtcbiAgICAgICAgICAgIHJldHVybiB7aWQ6IDAsIG5hbWU6ICdHdWVzdCd9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgfVxuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignU2VhcmNoQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlUGFyYW1zLCByZXNvdXJjZXMsIGd1aWRlcywgdXNlcikge1xuICAkc2NvcGUudGFncyA9ICRzdGF0ZVBhcmFtcy50YWdUaXRsZXMuc3BsaXQoJysnKTtcbiAgJHNjb3BlLnVzZXIgPSB1c2VyXG4gICRzY29wZS5yZXNvdXJjZXMgPSByZXNvdXJjZXM7XG4gICRzY29wZS5kYXRhID0gJHNjb3BlLnJlc291cmNlcy5zbGljZSgwLCA1KTtcbiAgJHNjb3BlLmdldE1vcmVEYXRhID0gZnVuY3Rpb24gKCkge1xuICAgICRzY29wZS5kYXRhID0gJHNjb3BlLnJlc291cmNlcy5zbGljZSgwLCAkc2NvcGUuZGF0YS5sZW5ndGggKyA1KTtcbiAgfVxuICAkc2NvcGUuZ3VpZGVzID0gZ3VpZGVzO1xuICAkc2NvcGUudXNlckd1aWRlcyA9IHVzZXIuZ3VpZGVzO1xufSk7XG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2lnbnVwJywge1xuICAgICAgICB1cmw6ICcvc2lnbnVwJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zaWdudXAvc2lnbnVwLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU2lnbnVwQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTaWdudXBDdHJsJywgZnVuY3Rpb24gKCRsb2csICRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgVGFnRmFjdG9yeSkge1xuXG4gICAgJHNjb3BlLmNoZWNrSW5mbyA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgJHNjb3BlLnVzZXIgPSB7fTtcblxuICAgICRzY29wZS5zZW5kU2lnblVwID0gZnVuY3Rpb24oc2lnblVwSW5mbykge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIGlmICgkc2NvcGUudXNlci5wYXNzd29yZCAhPT0gJHNjb3BlLnVzZXIucGFzc3dvcmRDb25maXJtKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnUGFzc3dvcmRzIGRvIG5vdCBtYXRjaCwgcGxlYXNlIHJlLWVudGVyIHBhc3N3b3JkLic7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBBdXRoU2VydmljZS5zaWdudXAoc2lnblVwSW5mbylcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVGFnRmFjdG9yeS5nZXRBbGwoKVxuICAgIC50aGVuKGZ1bmN0aW9uKHRhZ3Mpe1xuICAgIHZhciBhbGxUYWdzID0gdGFncztcblxuICAgICRzY29wZS5hbGxUYWdzID0gYWxsVGFncztcbiAgICAkc2NvcGUudXNlci50YWdzID0gW107XG5cbiAgICAkc2NvcGUucXVlcnlUYWdzID0gZnVuY3Rpb24oc2VhcmNoKSB7XG4gICAgICB2YXIgZmlyc3RQYXNzID0gYWxsVGFncy5maWx0ZXIoZnVuY3Rpb24odGFnKXtcbiAgICAgICAgcmV0dXJuIHRhZy50aXRsZS5pbmNsdWRlcyhzZWFyY2gudG9Mb3dlckNhc2UoKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBmaXJzdFBhc3MuZmlsdGVyKGZ1bmN0aW9uKHRhZyl7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAkc2NvcGUudXNlci50YWdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICBpZiAodGFnLnRpdGxlID09PSBzZWFyY2gpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAkc2NvcGUuYWRkVGFnID0gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgJHNjb3BlLnVzZXIudGFncy5wdXNoKGdyb3VwKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLiR3YXRjaENvbGxlY3Rpb24oJ3VzZXIudGFncycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAkc2NvcGUuYXZhaWxhYmxlVGFncyA9ICRzY29wZS5xdWVyeVRhZ3MoJycpO1xuICAgIH0pO1xuICB9KVxuICAuY2F0Y2goJGxvZy5lcnJvcik7XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0RhdGFGYWN0b3J5JywgZnVuY3Rpb24oKXtcbiAgICBsZXQgRGF0YUZhY3RvcnkgPSB7fTtcblxuICAgIERhdGFGYWN0b3J5LmdldERhdGEgPSBmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhXG4gICAgfVxuICAgIHJldHVybiBEYXRhRmFjdG9yeTtcbn0pXG4iLCJhcHAuZmFjdG9yeSgnR3VpZGVGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIERhdGFGYWN0b3J5KSB7XG4gICAgbGV0IEd1aWRlRmFjdG9yeSA9IHt9O1xuXG4gICAgR3VpZGVGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL2d1aWRlcycpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cbiAgICBHdWlkZUZhY3RvcnkuZ2V0QWxsQnlUYWcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHRhZ0lkcyA9IFsuLi5hcmd1bWVudHNdXG4gICAgICAgIHRhZ0lkcyA9IHRhZ0lkcy5qb2luKCcsJyk7XG4gICAgICAgIC8vICdhcGkvZ3VpZGVzP3RhZ0lkcz0xLDIsMydcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXM/dGFnSWRzPScgKyB0YWdJZHMpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cbiAgICBHdWlkZUZhY3RvcnkuZ2V0QnlBdXRob3IgPSBmdW5jdGlvbihhdXRob3JJZCkge1xuICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXM/YXV0aG9ySWQ9JyArIGF1dGhvcklkKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG4gICAgfVxuICAgR3VpZGVGYWN0b3J5LmdldEJ5SWQgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9ndWlkZXMvJyArIGlkKVxuICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LmFkZE5ld0d1aWRlID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9hcGkvZ3VpZGVzJywgZGF0YSlcbiAgICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcbiAgIH1cbiAgIEd1aWRlRmFjdG9yeS5hZGRSZXNvdXJjZSA9IGZ1bmN0aW9uKGlkLCBkYXRhKXtcbiAgICAgICByZXR1cm4gJGh0dHAucHV0KCcvYXBpL2d1aWRlcy8nICsgaWQgKyAnL2FkZCcsIGRhdGEpXG4gICB9XG4gICBHdWlkZUZhY3RvcnkucmVtb3ZlUmVzb3VyY2UgPSBmdW5jdGlvbihpZCwgZGF0YSl7XG4gICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9kZWxldGUnLCBkYXRhKVxuICAgfVxuICAgR3VpZGVGYWN0b3J5Lmxpa2UgPSBmdW5jdGlvbihpZCkge1xuICAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvZ3VpZGVzLycgKyBpZCArICcvbGlrZScpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LmRpc2xpa2UgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9kaXNsaWtlJyk7XG4gICB9XG4gICBHdWlkZUZhY3RvcnkudXBkYXRlT3JkZXIgPSBmdW5jdGlvbihpZCwgZGF0YSl7XG4gICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9vcmRlcicsIGRhdGEpO1xuICAgfVxuICAgR3VpZGVGYWN0b3J5LnJlbW92ZUxpa2UgPSBmdW5jdGlvbihpZCwgdXNlcklkKSB7XG4gICAgcmV0dXJuICRodHRwLmRlbGV0ZSgnL2FwaS9ndWlkZXMvJyArIGlkICsgJy9saWtlL3VzZXJzLycgKyB1c2VySWQpO1xuICB9O1xuICBHdWlkZUZhY3RvcnkucmVtb3ZlRGlzbGlrZSA9IGZ1bmN0aW9uKGlkLCB1c2VySWQpIHtcbiAgICByZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL2d1aWRlcy8nICsgaWQgKyAnL2Rpc2xpa2UvdXNlcnMvJyArIHVzZXJJZCk7XG4gIH07XG4gICByZXR1cm4gR3VpZGVGYWN0b3J5XG59KTtcbiIsImFwcC5mYWN0b3J5KCdSZWNvbW1lbmRhdGlvbkZhY3RvcnknLCBmdW5jdGlvbigpIHtcbiAgdmFyIFJlY29tbWVuZGF0aW9uRmFjdG9yeSA9IHt9O1xuXG4gIGxldCBpbnRlcnNlY3QgPSBmdW5jdGlvbihhLCBiKXtcbiAgICBsZXQgYWkgPSAwLCBiaSA9IDA7XG4gICAgbGV0IHJlc3VsdCA9IFtdO1xuXG4gICAgd2hpbGUgKCBhaSA8IGEubGVuZ3RoICYmIGJpIDwgYi5sZW5ndGggKXtcbiAgICAgIGlmIChhW2FpXSA8IGJbYmldICl7XG4gICAgICAgICBhaSsrO1xuICAgICAgICB9XG4gICAgICBlbHNlIGlmIChhW2FpXSA+IGJbYmldICl7XG4gICAgICAgICBiaSsrO1xuICAgICAgICB9XG4gICAgICBlbHNlIHsgLyogdGhleSdyZSBlcXVhbCAqL1xuICAgICAgICByZXN1bHQucHVzaChhW2FpXSk7XG4gICAgICAgIGFpKys7XG4gICAgICAgIGJpKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgbGV0IGNvbXBhcmUgPSBmdW5jdGlvbihhLCBiKXtcbiAgICBpZiAoYS5yYXRpbmcgPCBiLnJhdGluZykgcmV0dXJuIDE7XG4gICAgaWYgKGEucmF0aW5nID4gYi5yYXRpbmcpIHJldHVybiAtMTtcbiAgICByZXR1cm4gMFxuICB9O1xuXG4gIGZ1bmN0aW9uIHNodWZmbGUoYXJyYXkpIHtcbiAgICB2YXIgY29weSA9IFtdLCBuID0gYXJyYXkubGVuZ3RoLCBpO1xuICAgIC8vIFdoaWxlIHRoZXJlIHJlbWFpbiBlbGVtZW50cyB0byBzaHVmZmxl4oCmXG4gICAgd2hpbGUgKG4pIHtcbiAgICAgICAgLy8gUGljayBhIHJlbWFpbmluZyBlbGVtZW504oCmXG4gICAgICAgIGkgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnJheS5sZW5ndGgpO1xuXG4gICAgICAvLyBJZiBub3QgYWxyZWFkeSBzaHVmZmxlZCwgbW92ZSBpdCB0byB0aGUgbmV3IGFycmF5LlxuICAgICAgaWYgKGkgaW4gYXJyYXkpIHtcbiAgICAgICAgY29weS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgZGVsZXRlIGFycmF5W2ldO1xuICAgICAgICBuLS07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG5cbiAgUmVjb21tZW5kYXRpb25GYWN0b3J5LmdldCA9IGZ1bmN0aW9uKHJlc291cmNlcywgY3VycmVudFVzZXIpIHtcbiAgICBsZXQgcmVjb21tZW5kZWQgPSBbXTtcbiAgICBsZXQgc2h1ZmZsZUdyb3VwID0gW107XG4gICAgXG4gICAgcmVzb3VyY2VzLmZvckVhY2goZnVuY3Rpb24ocmVzb3VyY2Upe1xuICAgICAgLy9Gb3JtdWxhIGZvciBjYWxjdWxhdGluZyBob3cgbWFueSBmcmllbmRzIGxpa2UgZWFjaCByZXNvdXJjZS5cbiAgICAgIHZhciBjdXJyZW50UmF0aW5nID0gaW50ZXJzZWN0KGN1cnJlbnRVc2VyLmZyaWVuZCwgcmVzb3VyY2UubGlrZVVzZXIpLmxlbmd0aCAtIGludGVyc2VjdChjdXJyZW50VXNlci5mcmllbmQsIHJlc291cmNlLmRpc2xpa2VVc2VyKS5sZW5ndGg7XG4gICAgICBpZiAoY3VycmVudFJhdGluZyA+PSAwICYmIChyZXNvdXJjZS5kaXNsaWtlVXNlci5pbmRleE9mKGN1cnJlbnRVc2VyLmlkKSA9PT0gLTEpICYmIChyZXNvdXJjZS5saWtlVXNlci5pbmRleE9mKGN1cnJlbnRVc2VyLmlkKSA9PT0gLTEpKXtcbiAgICAgICAgdmFyIG9iaiA9IHtyZXNvdXJjZTogcmVzb3VyY2UsIHJhdGluZzogY3VycmVudFJhdGluZ307XG4gICAgICAgIGlmIChjdXJyZW50UmF0aW5nID09PSAwKSBzaHVmZmxlR3JvdXAucHVzaChvYmopO1xuICAgICAgICBlbHNlIHJlY29tbWVuZGVkLnB1c2gob2JqKTtcbiAgICAgIH1cbiAgICB9KVxuICAgIHNodWZmbGVHcm91cCA9IHNodWZmbGUoc2h1ZmZsZUdyb3VwKTtcbiAgICByZWNvbW1lbmRlZCA9IHJlY29tbWVuZGVkLmNvbmNhdChzaHVmZmxlR3JvdXApO1xuICAgIC8vVXNlcyBhcnJheS5zb3J0IHRvIHNvcnQgdGhlIHJlY29tbWVuZGVkIHJlc291cmNlcyBudW1lcmljYWxseSBieSByYXRpbmdcbiAgICByZXR1cm4gcmVjb21tZW5kZWQuc29ydChjb21wYXJlKTtcbiAgfVxuICByZXR1cm4gUmVjb21tZW5kYXRpb25GYWN0b3J5O1xufSk7XG4iLCJhcHAuZmFjdG9yeSgnUmVzb3VyY2VGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIERhdGFGYWN0b3J5KSB7XG5cdGxldCBSZXNvdXJjZUZhY3RvcnkgPSB7fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9yZXNvdXJjZXMnKVxuXHRcdC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuXHR9O1xuXHRSZXNvdXJjZUZhY3RvcnkuZ2V0QWxsQnlUYWcgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdGFnSWRzID0gWy4uLmFyZ3VtZW50c107XG5cdFx0dGFnSWRzID0gdGFnSWRzLmpvaW4oJywnKTtcblx0XHQvLyAgJy9hcGkvcmVzb3VyY2VzP3RhZ0lkcz0xLDIsMywnXG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9yZXNvdXJjZXM/dGFnSWRzPScgKyB0YWdJZHMpXG5cdFx0LnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5VHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcz90eXBlPScgKyB0eXBlKVxuXHRcdC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuXHR9O1xuXG5cdFJlc291cmNlRmFjdG9yeS5nZXRBbGxCeUF1dGhvciA9IGZ1bmN0aW9uKGF1dGhvcil7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9yZXNvdXJjZXM/YXV0aG9yPScgKyBhdXRob3IpXG5cdFx0LnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5U291cmNlID0gZnVuY3Rpb24oc291cmNlKXtcblx0XHRzb3VyY2UgPSBzb3VyY2UucmVwbGFjZSgnKycsICclMkInKTtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcz9zb3VyY2U9JyArIHNvdXJjZSlcblx0XHQudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcblx0fVxuXG5cdFJlc291cmNlRmFjdG9yeS5nZXRCeUlkID0gZnVuY3Rpb24oaWQpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Jlc291cmNlcy8nICsgaWQpXG5cdFx0LnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LnBvc3QgPSBmdW5jdGlvbihkYXRhKSB7XG5cdFx0cmV0dXJuICRodHRwLnBvc3QoJy9hcGkvcmVzb3VyY2VzJywgZGF0YSlcblx0XHQudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkubGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLnB1dCgnL2FwaS9yZXNvdXJjZXMvJyArIGlkICsgJy9saWtlJyk7XG5cdH07XG5cblx0UmVzb3VyY2VGYWN0b3J5LmRpc2xpa2UgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5wdXQoJy9hcGkvcmVzb3VyY2VzLycgKyBpZCArICcvZGlzbGlrZScpO1xuXHR9O1xuXG5cdFJlc291cmNlRmFjdG9yeS5yZW1vdmVMaWtlID0gZnVuY3Rpb24oaWQsIHVzZXJJZCkge1xuXHRcdHJldHVybiAkaHR0cC5kZWxldGUoJy9hcGkvcmVzb3VyY2VzLycgKyBpZCArICcvbGlrZS91c2Vycy8nICsgdXNlcklkKTtcblx0fTtcblxuXHRSZXNvdXJjZUZhY3RvcnkucmVtb3ZlRGlzbGlrZSA9IGZ1bmN0aW9uKGlkLCB1c2VySWQpIHtcblx0XHRyZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL3Jlc291cmNlcy8nICsgaWQgKyAnL2Rpc2xpa2UvdXNlcnMvJyArIHVzZXJJZCk7XG5cdH07XG5cblJlc291cmNlRmFjdG9yeS5kZWxldGUgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5kZWxldGUoJ2FwaS9yZXNvdXJjZXMvJyArIGlkKTtcbn07XG5cblx0cmV0dXJuIFJlc291cmNlRmFjdG9yeTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1RhZ0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCwgRGF0YUZhY3Rvcnkpe1xuICAgIGxldCBUYWdGYWN0b3J5ID0ge307XG5cbiAgICBUYWdGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdGFncycpXG4gICAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpXG4gICAgfVxuICAgIFRhZ0ZhY3RvcnkuYWRkVGFnID0gZnVuY3Rpb24oaW5mbyl7XG4gICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL3RhZ3MnLCBpbmZvKVxuICAgICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKVxuICAgIH1cblxuICAgIFRhZ0ZhY3RvcnkuZ2V0QnlJZCA9IGZ1bmN0aW9uKGlkKXtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS90YWdzLycgKyBpZClcbiAgICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSlcbiAgICB9XG4gICAgcmV0dXJuIFRhZ0ZhY3Rvcnk7XG59KVxuIiwiYXBwLmZhY3RvcnkoJ1VzZXJGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsIERhdGFGYWN0b3J5KXtcbiAgICBsZXQgVXNlckZhY3RvcnkgPSB7fTtcblxuICAgIFVzZXJGYWN0b3J5LmdldEFsbCA9IGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3VzZXJzJylcbiAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpXG4gICAgfVxuXG4gICAgVXNlckZhY3RvcnkuZ2V0QnlJZCA9IGZ1bmN0aW9uKGlkKXtcbiAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdXNlcnMvJyArIGlkKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSlcbiAgICB9XG5cbiAgICBVc2VyRmFjdG9yeS5hZGRVc2VyID0gZnVuY3Rpb24oaW5mbyl7XG4gICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2FwaS91c2VycycsIGluZm8pXG4gICAgICAudGhlbihEYXRhRmFjdG9yeS5nZXREYXRhKVxuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LnNldFRhZ3MgPSBmdW5jdGlvbihpZCwgdGFncykge1xuICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS91c2Vycy8nICsgaWQgKyAnL3NldHRhZ3MnLCB0YWdzKVxuICAgICAgLnRoZW4oRGF0YUZhY3RvcnkuZ2V0RGF0YSk7XG4gICAgfVxuXG4gICAgVXNlckZhY3RvcnkuZ2V0QnlUYWdzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdGFnSWRzID0gWy4uLmFyZ3VtZW50c107XG4gICAgICB0YWdJZHMgPSB0YWdJZHMuam9pbignLCcpO1xuICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS91c2Vycz90YWdJZHM9JyArIHRhZ0lkcylcbiAgICAgIC50aGVuKERhdGFGYWN0b3J5LmdldERhdGEpO1xuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LmFkZEZyaWVuZCA9IGZ1bmN0aW9uKHVzZXJJZCwgZnJpZW5kSWQpIHtcbiAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvdXNlcnMvJyArIHVzZXJJZCArICcvYWRkRnJpZW5kJywgZnJpZW5kSWQpO1xuICAgIH1cblxuICAgIFVzZXJGYWN0b3J5LmRlbGV0ZUZyaWVuZCA9IGZ1bmN0aW9uKHVzZXJJZCwgZnJpZW5kSWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdmcmllbmRJZCcsIGZyaWVuZElkKTtcbiAgICAgIHJldHVybiAkaHR0cC5kZWxldGUoJy9hcGkvdXNlcnMvJyArIHVzZXJJZCArICcvZGVsZXRlRnJpZW5kLycgKyBmcmllbmRJZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFVzZXJGYWN0b3J5O1xufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3NlYXJjaEF1dGhvclJlc3VsdHMnLCB7XG4gICAgdXJsOiAnL3NlYXJjaF9yZXN1bHRzL2F1dGhvci86YXV0aG9yTmFtZScsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9zZWFyY2hfcmVzdWx0cy9zZWFyY2hfcmVzdWx0cy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnU2VhcmNoQXV0aG9yQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgcmVzb3VyY2VzOiBmdW5jdGlvbihSZXNvdXJjZUZhY3RvcnksICRzdGF0ZVBhcmFtcykge1xuICAgICAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5QXV0aG9yKCRzdGF0ZVBhcmFtcy5hdXRob3JOYW1lKTtcbiAgICAgIH0sXG4gICAgICB1c2VyOiBmdW5jdGlvbihBdXRoU2VydmljZSwgVXNlckZhY3Rvcnkpe1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAgICAgaWYgKCF1c2VyKXtcbiAgICAgICAgICAgIHJldHVybiB7aWQ6IDAsIG5hbWU6ICdHdWVzdCd9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBVc2VyRmFjdG9yeS5nZXRCeUlkKHVzZXIuaWQpO1xuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ1NlYXJjaEF1dGhvckN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIHJlc291cmNlcywgdXNlciwgJHN0YXRlUGFyYW1zKSB7XG4gICRzY29wZS5hdXRob3IgPSAkc3RhdGVQYXJhbXMuYXV0aG9yTmFtZTtcbiAgJHNjb3BlLnVzZXIgPSB1c2VyO1xuICAkc2NvcGUuZ3VpZGVzID0gW107XG4gICRzY29wZS5kYXRhID0gcmVzb3VyY2VzLnNsaWNlKDAsIDUpO1xuICAkc2NvcGUuZ2V0TW9yZURhdGEgPSBmdW5jdGlvbigpe1xuICAgICRzY29wZS5kYXRhID0gcmVzb3VyY2VzLnNsaWNlKDAsICRzY29wZS5kYXRhLmxlbmd0aCArIDUpO1xuICB9O1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdzZWFyY2hTb3VyY2VSZXN1bHRzJywge1xuICAgIHVybDogJy9zZWFyY2hfcmVzdWx0cy9zb3VyY2UvOnNvdXJjZScsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9zZWFyY2hfcmVzdWx0cy9zZWFyY2hfcmVzdWx0cy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnU2VhcmNoU291cmNlQ3RybCcsXG4gICAgcmVzb2x2ZToge1xuICAgICAgcmVzb3VyY2VzOiBmdW5jdGlvbihSZXNvdXJjZUZhY3RvcnksICRzdGF0ZVBhcmFtcykge1xuICAgICAgICByZXR1cm4gUmVzb3VyY2VGYWN0b3J5LmdldEFsbEJ5U291cmNlKCRzdGF0ZVBhcmFtcy5zb3VyY2UpO1xuICAgICAgfSxcbiAgICAgIHVzZXI6IGZ1bmN0aW9uKEF1dGhTZXJ2aWNlLCBVc2VyRmFjdG9yeSl7XG4gICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICBpZiAoIXVzZXIpe1xuICAgICAgICAgICAgcmV0dXJuIHtpZDogMCwgbmFtZTogJ0d1ZXN0J31cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFVzZXJGYWN0b3J5LmdldEJ5SWQodXNlci5pZCk7XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignU2VhcmNoU291cmNlQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgcmVzb3VyY2VzLCB1c2VyLCAkc3RhdGVQYXJhbXMpIHtcbiAgJHNjb3BlLnNvdXJjZSA9ICRzdGF0ZVBhcmFtcy5zb3VyY2VcbiAgJHNjb3BlLnVzZXIgPSB1c2VyXG4gICRzY29wZS5ndWlkZXMgPSBbXTtcbiAgJHNjb3BlLnJlc291cmNlcyA9IHJlc291cmNlc1xuICAkc2NvcGUuZGF0YSA9ICRzY29wZS5yZXNvdXJjZXMuc2xpY2UoMCwgNSk7XG4gICRzY29wZS5nZXRNb3JlRGF0YSA9IGZ1bmN0aW9uKCl7XG4gICAgJHNjb3BlLmRhdGEgPSAkc2NvcGUucmVzb3VyY2VzLnNsaWNlKDAsICRzY29wZS5kYXRhLmxlbmd0aCArIDUpO1xuICB9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ2FkZFRvR3VpZGUnLCBmdW5jdGlvbigkbWREaWFsb2csICRtZFRvYXN0LCBHdWlkZUZhY3RvcnksICRsb2cpe1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9hZGQtdG8tZ3VpZGUvYWRkLXRvLWd1aWRlLmh0bWwnLFxuXHRcdHNjb3BlOiB7XG4gICAgICByZXNvdXJjZTogJz0nLFxuICAgICAgdXNlckd1aWRlczogJz0nLFxuICAgICAgdXNlcjogJz0nXG4gICAgfSxcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSkge1xuXHRcdFx0c2NvcGUuZ3VpZGUgPSB7dGFnczogW119XG4gICAgICBzY29wZS5vcGVuUGFuZWwgPSBmYWxzZTtcblxuXHRcdFx0c2NvcGUubmV3R3VpZGUgPSBmYWxzZTtcblx0XHRcdHNjb3BlLm9wZW5Ub2FzdCA9IGZ1bmN0aW9uKCl7XG5cdFx0XHRcdCRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKClcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQudGV4dENvbnRlbnQoJ1Jlc291cmNlIGFkZGVkIHRvIEd1aWRlIScpKTtcblx0XHRcdH1cblxuXHRcdFx0c2NvcGUuc2hvd0FkdmFuY2VkID0gZnVuY3Rpb24oKXtcblx0XHRcdFx0JG1kRGlhbG9nLnNob3coe1xuICAgICAgICAgIHNjb3BlOiBzY29wZSxcbiAgICAgICAgICBwcmVzZXJ2ZVNjb3BlOiB0cnVlLFxuXHRcdFx0XHRcdHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvYWRkLXRvLWd1aWRlL2RpYWxvZy10ZW1wbGF0ZS5odG1sJyxcblx0XHRcdFx0XHRjbGlja091dHNpZGVUb0Nsb3NlOiB0cnVlLFxuXHRcdFx0XHRcdGVzY2FwZVRvQ2xvc2U6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5jbGVhckZvcm0gPSBmdW5jdGlvbigpe1xuXHRcdFx0XHRzY29wZS5ndWlkZUZvcm0uJHNldFByaXN0aW5lKCk7XG5cdFx0XHRcdHNjb3BlLmd1aWRlRm9ybS4kc2V0VW50b3VjaGVkKCk7XG5cdFx0XHRcdHNjb3BlLmd1aWRlID0ge3RhZ3M6IFtdfVxuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5zdWJtaXRGb3JtID0gZnVuY3Rpb24oKXtcblx0XHRcdFx0aWYgKHNjb3BlLmd1aWRlLmlkKXtcblx0XHRcdFx0XHRyZXR1cm4gR3VpZGVGYWN0b3J5LmFkZFJlc291cmNlKHNjb3BlLmd1aWRlLmlkLCBzY29wZS5yZXNvdXJjZSlcblx0XHRcdFx0XHQudGhlbihmdW5jdGlvbigpe1xuXHRcdFx0XHRcdFx0c2NvcGUuY2xlYXJGb3JtKCk7XG5cdFx0XHRcdFx0XHQkbWREaWFsb2cuaGlkZSgpO1xuXHRcdFx0XHRcdFx0c2NvcGUub3BlblRvYXN0KCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChzY29wZS5ndWlkZS50aXRsZSl7XG5cdFx0XHRcdFx0cmV0dXJuIEd1aWRlRmFjdG9yeS5hZGROZXdHdWlkZSh7dGl0bGU6IHNjb3BlLmd1aWRlLnRpdGxlLCBhdXRob3I6IHNjb3BlLnVzZXIsIGRlc2NyaXB0aW9uOiBzY29wZS5ndWlkZS5kZXNjcmlwdGlvbiwgdGFnczogc2NvcGUuZ3VpZGUudGFnc30pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oZ3VpZGUpe1xuXHRcdFx0XHRcdFx0cmV0dXJuIEd1aWRlRmFjdG9yeS5hZGRSZXNvdXJjZShndWlkZS5pZCwgc2NvcGUucmVzb3VyY2UpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRcdHNjb3BlLmNsZWFyRm9ybSgpO1xuXHRcdFx0XHRcdFx0JG1kRGlhbG9nLmhpZGUoKTtcblx0XHRcdFx0XHRcdHNjb3BlLm9wZW5Ub2FzdCgpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0LmNhdGNoKCRsb2cuZXJyb3IpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pXG4iLCJhcHAuZGlyZWN0aXZlKCdmYWInLCBmdW5jdGlvbiAoJG1kRGlhbG9nLCBBdXRoU2VydmljZSwgJGxvZywgVXNlckZhY3RvcnksICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCBSZXNvdXJjZUZhY3RvcnksICRtZFRvYXN0LCBHdWlkZUZhY3RvcnkpIHtcbnJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2ZhYi9mYWIuaHRtbCcsXG4gICAgc2NvcGU6IHRydWUsXG4gICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHtcbiAgICAgIHNjb3BlLnJlc291cmNlID0ge3RhZ3M6IFtdfTtcbiAgICAgIHNjb3BlLnR5cGVzID0gW1xuICAgICAgICAnYXJ0aWNsZScsXG4gICAgICAgICdib29rJyxcbiAgICAgICAgJ2Jsb2cnLFxuICAgICAgICAncG9kY2FzdCcsXG4gICAgICAgICd3ZWJzaXRlJ1xuICAgICAgXTtcblxuICAgICAgc2NvcGUub3BlblRvYXN0ID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAkbWRUb2FzdC5zaG93KCRtZFRvYXN0LnNpbXBsZSgpXG4gICAgICAgICAgICAgICAgICAgICAgLnRleHRDb250ZW50KG1lc3NhZ2UpKTtcbiAgICAgIH07XG5cbiAgICAgIHZhciBnZXRHdWlkZXMgPSBmdW5jdGlvbigpe1xuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgIGlmICghdXNlcikge1xuICAgICAgICAgICAgc2NvcGUubG9nZ2VkSW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzY29wZS5sb2dnZWRJbiA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gVXNlckZhY3RvcnkuZ2V0QnlJZCh1c2VyLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKGZ1bGxVc2VyKXtcbiAgICAgICAgICBzY29wZS5ndWlkZXMgPSBmdWxsVXNlci5ndWlkZXM7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgIH07XG5cbiAgICAgIHZhciBjbGVhckd1aWRlcyA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHNjb3BlLmd1aWRlcyA9IFtdO1xuICAgICAgICBzY29wZS5sb2dnZWRJbiA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBzY29wZS5zaG93RGlhbG9nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRtZERpYWxvZy5zaG93KHtcbiAgICAgICAgICBjb250ZW50RWxlbWVudDogJyNyZXNvdXJjZURpYWxvZycsXG4gICAgICAgICAgcGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG4gICAgICAgICAgY2xpY2tPdXRzaWRlVG9DbG9zZTogdHJ1ZSxcbiAgICAgICAgICBlc2NhcGVUb0Nsb3NlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgc2NvcGUuY2xlYXJGb3JtID0gZnVuY3Rpb24oKXtcbiAgICAgICAgc2NvcGUucmVzb3VyY2VGb3JtLiRzZXRQcmlzdGluZSgpO1xuICAgICAgICBzY29wZS5yZXNvdXJjZUZvcm0uJHNldFVudG91Y2hlZCgpO1xuICAgICAgICBzY29wZS5yZXNvdXJjZSA9IHt0YWdzOiBbXX07XG4gICAgICB9XG5cbiAgICAgIHNjb3BlLnN1Ym1pdEZvcm0gPSBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgY3JlYXRlZDtcbiAgICAgICAgaWYgKHNjb3BlLnJlc291cmNlLnRhZ3MubGVuZ3RoID09PSAwKXtcbiAgICAgICAgICAgIHNjb3BlLnJlc291cmNlRm9ybS50YWdzLiRpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzY29wZS5yZXNvdXJjZUZvcm0uJHZhbGlkKSB7XG4gICAgICAgICAgUmVzb3VyY2VGYWN0b3J5LnBvc3Qoc2NvcGUucmVzb3VyY2UpXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgICAgICAgIGNyZWF0ZWQgPSByZXN1bHQuY3JlYXRlZDtcbiAgICAgICAgICAgIGlmIChzY29wZS5yZXNvdXJjZS5ndWlkZSkge1xuICAgICAgICAgICAgICB2YXIgZ3VpZGVJZCA9IHNjb3BlLnJlc291cmNlLmd1aWRlO1xuICAgICAgICAgICAgICByZXR1cm4gR3VpZGVGYWN0b3J5LmFkZFJlc291cmNlKGd1aWRlSWQsIHJlc3VsdC5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgcmV0dXJuO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gY3JlYXRlZCA/ICdSZXNvdXJjZSBjcmVhdGVkIScgOiAnUmVzb3VyY2UgYWxyZWFkeSBleGlzdHMhJztcbiAgICAgICAgICAgIGlmIChzY29wZS5yZXNvdXJjZS5ndWlkZSkgbWVzc2FnZSArPSAnIEFkZGVkIHRvIGd1aWRlLidcbiAgICAgICAgICAgIHNjb3BlLmNsZWFyRm9ybSgpO1xuICAgICAgICAgICAgJG1kRGlhbG9nLmhpZGUoKTtcbiAgICAgICAgICAgIHNjb3BlLm9wZW5Ub2FzdChtZXNzYWdlKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgZ2V0R3VpZGVzKCk7XG5cbiAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2VzcywgZ2V0R3VpZGVzKTtcbiAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIGNsZWFyR3VpZGVzKTtcbiAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBjbGVhckd1aWRlcyk7XG5cbiAgICB9XG4gIH1cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgnZ3VpZGVDYXJkJywgZnVuY3Rpb24oR3VpZGVGYWN0b3J5LCAkc3RhdGUsICRsb2cpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvZ3VpZGUtY2FyZC9ndWlkZS1jYXJkLmh0bWwnLFxuICAgIHNjb3BlOiB0cnVlLFxuICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlKSB7XG4gICAgICBsZXQgbGlrZWQgPSBzY29wZS51c2VyLmd1aWRlTGlrZS5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5pZCA9PT0gc2NvcGUuZ3VpZGUuaWQ7XG4gICAgICAgICAgICAgICAgICAgIH0pLmxlbmd0aCA9PT0gMTtcblxuICAgICAgbGV0IGRpc2xpa2VkID0gc2NvcGUudXNlci5ndWlkZURpc2xpa2UuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5pZCA9PT0gc2NvcGUuZ3VpZGUuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgfSkubGVuZ3RoID09PSAxO1xuXG4gICAgICBzY29wZS5saWtlID0gZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgaWYgKHNjb3BlLnVzZXIuZ3VpZGVMaWtlLmZpbHRlcihmdW5jdGlvbihndWlkZSkge1xuICAgICAgICAgIHJldHVybiBndWlkZS5pZCA9PT0gaWQ7XG4gICAgICAgIH0pLmxlbmd0aCA9PT0gMCAmJiAhbGlrZWQpe1xuICAgICAgICAgIEd1aWRlRmFjdG9yeS5saWtlKGlkKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbGlrZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2NvcGUuZ3VpZGUubGlrZXMgKz0gMTtcblxuICAgICAgICAgICAgaWYgKGRpc2xpa2VkKSB7XG4gICAgICAgICAgICAgIGRpc2xpa2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgIHNjb3BlLmd1aWRlLmRpc2xpa2VzIC09IDE7XG4gICAgICAgICAgICAgIHJldHVybiBHdWlkZUZhY3RvcnkucmVtb3ZlRGlzbGlrZShpZCwgc2NvcGUudXNlci5pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHNjb3BlLmRpc2xpa2UgPSBmdW5jdGlvbihpZCkge1xuICAgICAgICBpZiAoc2NvcGUudXNlci5ndWlkZURpc2xpa2UuZmlsdGVyKGZ1bmN0aW9uKGd1aWRlKXtcbiAgICAgICAgICByZXR1cm4gZ3VpZGUuaWQgPT09IGlkO1xuICAgICAgICB9KS5sZW5ndGggPT09IDAgJiYgIWRpc2xpa2VkKXtcbiAgICAgICAgICBHdWlkZUZhY3RvcnkuZGlzbGlrZShpZClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGRpc2xpa2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHNjb3BlLmd1aWRlLmRpc2xpa2VzICs9IDE7XG5cbiAgICAgICAgICAgIGlmIChsaWtlZCkge1xuICAgICAgICAgICAgICBsaWtlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBzY29wZS5ndWlkZS5saWtlcyAtPSAxO1xuICAgICAgICAgICAgICByZXR1cm4gR3VpZGVGYWN0b3J5LnJlbW92ZUxpa2UoaWQsIHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNhdGNoKCRsb2cuZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBzY29wZS5maW5kRnJpZW5kID0gZnVuY3Rpb24oZnJpZW5kSWQpIHtcbiAgICAgICAgICAkc3RhdGUuZ28oJ2ZyaWVuZCcsIHtmcmllbmRJZDogZnJpZW5kSWR9KTtcbiAgICAgIH07XG4gICAgfVxuICB9O1xufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsIEFVVEhfRVZFTlRTLCAkc3RhdGUpIHtcblxuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgc2NvcGU6IHt9LFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5odG1sJyxcbiAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUpIHtcblxuICAgICAgc2NvcGUuaXRlbXMgPSBbXG4gICAgICAgIHsgbGFiZWw6ICdOZXcgUmVzb3VyY2VzJywgc3RhdGU6ICduZXdSZXNvdXJjZXMnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdOZXcgR3VpZGVzJywgc3RhdGU6ICduZXdHdWlkZXMnIH0sXG4gICAgICAgIHsgbGFiZWw6ICdQZW9wbGUnLCBzdGF0ZTogJ3NlYXJjaFBlb3BsZSd9XG4gICAgICBdO1xuXG4gICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpO1xuICAgICAgfTtcblxuICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgdmFyIHNldFVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIHZhciByZW1vdmVVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgIH07XG5cbiAgICAgIHNldFVzZXIoKTtcblxuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG4gICAgfVxuXG4gIH07XG5cbn0pO1xuIiwiXG5hcHAuZGlyZWN0aXZlKCdyZXNvdXJjZUNhcmQnLCBmdW5jdGlvbiAoJHN0YXRlLCAkbG9nLCBSZXNvdXJjZUZhY3RvcnksIEd1aWRlRmFjdG9yeSkge1xuICAgIHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0UnLFxuXHRcdFx0dGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9yZXNvdXJjZS1jYXJkL3Jlc291cmNlLWNhcmQuaHRtbCcsXG5cdFx0XHRzY29wZTogdHJ1ZSxcblx0XHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG4gICAgICAgIGxldCBsaWtlZCA9IHNjb3BlLnVzZXIucmVzb3VyY2VMaWtlLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uaWQgPT09IHNjb3BlLnJlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgICAgICAgIH0pLmxlbmd0aCA9PT0gMTtcblxuICAgICAgICBsZXQgZGlzbGlrZWQgPSBzY29wZS51c2VyLnJlc291cmNlRGlzbGlrZS5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uaWQgPT09IHNjb3BlLnJlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkubGVuZ3RoID09PSAxO1xuXG4gICAgICBzY29wZS5saWtlID0gZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgaWYgKHNjb3BlLnVzZXIucmVzb3VyY2VMaWtlLmZpbHRlcihmdW5jdGlvbihyZXNvdXJjZSl7XG4gICAgICAgICAgcmV0dXJuIHJlc291cmNlLmlkID09PSBpZDtcbiAgICAgICAgfSkubGVuZ3RoID09PSAwICYmICFsaWtlZCl7XG4gICAgICAgICAgUmVzb3VyY2VGYWN0b3J5Lmxpa2UoaWQpXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBsaWtlZCA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5yZXNvdXJjZS5saWtlcyArPSAxO1xuXG4gICAgICAgICAgICBpZiAoZGlzbGlrZWQpIHtcbiAgICAgICAgICAgICAgZGlzbGlrZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgc2NvcGUucmVzb3VyY2UuZGlzbGlrZXMgLT0gMTtcbiAgICAgICAgICAgICAgcmV0dXJuIFJlc291cmNlRmFjdG9yeS5yZW1vdmVEaXNsaWtlKGlkLCBzY29wZS51c2VyLmlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgc2NvcGUuZGlzbGlrZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICBpZiAoc2NvcGUudXNlci5yZXNvdXJjZURpc2xpa2UuZmlsdGVyKGZ1bmN0aW9uKHJlc291cmNlKXtcbiAgICAgICAgcmV0dXJuIHJlc291cmNlLmlkID09PSBpZDtcbiAgICAgIH0pLmxlbmd0aCA9PT0gMCAmJiAhZGlzbGlrZWQpe1xuICAgICAgICBSZXNvdXJjZUZhY3RvcnkuZGlzbGlrZShpZClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZGlzbGlrZWQgPSB0cnVlO1xuICAgICAgICAgIHNjb3BlLnJlc291cmNlLmRpc2xpa2VzICs9IDE7XG5cbiAgICAgICAgICBpZiAobGlrZWQpIHtcbiAgICAgICAgICAgIGxpa2VkID0gZmFsc2U7XG4gICAgICAgICAgICBzY29wZS5yZXNvdXJjZS5saWtlcyAtPSAxO1xuICAgICAgICAgICAgcmV0dXJuIFJlc291cmNlRmFjdG9yeS5yZW1vdmVMaWtlKGlkLCBzY29wZS51c2VyLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgkbG9nLmVycm9yKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgICBzY29wZS51c2VyR3VpZGVzID0gc2NvcGUudXNlci5ndWlkZXM7XG5cblx0XHRcdHNjb3BlLnNlYXJjaEJ5VGFnID0gZnVuY3Rpb24oaWQsIHRpdGxlKSB7XG5cdFx0XHRcdCRzdGF0ZS5nbygnc2VhcmNoUmVzdWx0cycsIHt0YWdJZHM6IGlkLCB0YWdUaXRsZXM6IHRpdGxlfSk7XG5cdFx0XHR9XG5cblx0XHRcdHNjb3BlLnNlYXJjaEJ5QXV0aG9yID0gZnVuY3Rpb24oYXV0aG9yTmFtZSkge1xuXHRcdFx0XHQkc3RhdGUuZ28oJ3NlYXJjaEF1dGhvclJlc3VsdHMnLCB7YXV0aG9yTmFtZTogYXV0aG9yTmFtZX0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5zZWFyY2hCeVNvdXJjZSA9IGZ1bmN0aW9uKHNvdXJjZSkge1xuXHRcdFx0XHQkc3RhdGUuZ28oJ3NlYXJjaFNvdXJjZVJlc3VsdHMnLCB7c291cmNlOiBzb3VyY2V9KVxuXHRcdFx0fVxuXG5cdFx0XHRzY29wZS5kZWxldGUgPSBmdW5jdGlvbihpZCl7XG5cdFx0XHRcdGlmIChzY29wZS51c2VyLmlzQWRtaW4pe1xuXHRcdFx0XHRcdFJlc291cmNlRmFjdG9yeS5kZWxldGUoaWQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0c2NvcGUucmVtb3ZlID0gZnVuY3Rpb24oaWQpe1xuXHRcdFx0XHRpZiAoc2NvcGUudXNlci5pZCA9PT0gc2NvcGUuYXV0aG9yLmlkKXtcblx0XHRcdFx0XHRHdWlkZUZhY3RvcnkucmVtb3ZlUmVzb3VyY2Uoc2NvcGUuZ3VpZGUuaWQsIHtpZDogaWR9KVxuXHRcdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5odG1sKCcnKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoJ3RhZ0NoaXBzJywgZnVuY3Rpb24gKFRhZ0ZhY3RvcnksIFJlc291cmNlRmFjdG9yeSwgJGxvZykge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvdGFnLWNoaXBzL3RhZy1jaGlwcy5odG1sJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICBzZWxlY3RlZFRhZ3M6ICc9JyxcbiAgICAgICAgICBtYXRjaDogJz0nXG4gICAgICAgIH0sXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlKSB7XG5cbiAgICAgICAgICBUYWdGYWN0b3J5LmdldEFsbCgpXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24odGFncyl7XG4gICAgICAgICAgICB2YXIgYWxsVGFncyA9IHRhZ3M7XG4gICAgICAgICAgICBzY29wZS5hbGxUYWdzID0gYWxsVGFncztcblxuICAgICAgICAgICAgc2NvcGUucXVlcnlUYWdzID0gZnVuY3Rpb24oc2VhcmNoKSB7XG4gICAgICAgICAgICAgIHZhciBmaXJzdFBhc3MgPSBhbGxUYWdzLmZpbHRlcihmdW5jdGlvbih0YWcpe1xuICAgICAgICAgICAgICAgIHJldHVybiB0YWcudGl0bGUuaW5jbHVkZXMoc2VhcmNoLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICByZXR1cm4gZmlyc3RQYXNzLmZpbHRlcihmdW5jdGlvbih0YWcpe1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2NvcGUuc2VsZWN0ZWRUYWdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgICAgICAgIGlmICh0YWcudGl0bGUgPT09IHNlYXJjaCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS50cmFuc2Zvcm1DaGlwID0gZnVuY3Rpb24oY2hpcCkge1xuICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc09iamVjdChjaGlwKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGlwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGNoaXApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB0aXRsZTogY2hpcC50b0xvd2VyQ2FzZSgpLCB0eXBlOiAnbmV3JyB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLiR3YXRjaENvbGxlY3Rpb24oJ3NlbGVjdGVkVGFncycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLmF2YWlsYWJsZVRhZ3MgPSBzY29wZS5xdWVyeVRhZ3MoJycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goJGxvZy5lcnJvcik7XG5cbiAgICAgICAgfVxuICAgIH07XG4gIH0pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
