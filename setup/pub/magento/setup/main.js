/**
 * Copyright © 2016 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */

'use strict';
var main = angular.module('main', ['ngStorage', 'ngDialog']);
main.controller('navigationController',
        ['$scope', '$state', '$rootScope', '$window', 'navigationService', '$localStorage',
            function ($scope, $state, $rootScope, $window, navigationService, $localStorage) {

    function loadMenu() {
        angular.element(document).ready(function() {
            $scope.menu = $localStorage.menu;
        });
    }

    navigationService.load().then(loadMenu);

    $rootScope.isMenuEnabled = true;
    $scope.itemStatus = function (order) {
        return $state.$current.order <= order || !$rootScope.isMenuEnabled;
    };
}])
.controller('headerController', ['$scope', '$localStorage', '$window',
        function ($scope, $localStorage, $window) {
            if ($localStorage.titles) {
                $scope.titles = $localStorage.titles;
            }
            $scope.redirectTo = function (url) {
                if (url) {
                    $window.location.href = url;
                }
            };
        }
    ]
)
.controller('mainController', [
    '$scope', '$state', 'navigationService', '$localStorage', '$interval', '$http',
    function ($scope, $state, navigationService, $localStorage, $interval, $http) {
        $interval(
            function () {
                $http.post('index.php/session/prolong')
                    .success(function (result) {
                    })
                    .error(function (result) {
                    });
            },
            25000
        );

        $scope.moduleName = $localStorage.moduleName;
        $scope.$on('$stateChangeSuccess', function (event, state) {
            $scope.valid = true;
        });

        $scope.nextState = function () {
            if ($scope.validate()) {
                $scope.$broadcast('nextState', $state.$current);
                $state.go(navigationService.getNextState().id);
            }
        };

        $scope.goToState = function (stateId) {
            $state.go(stateId)
        };

        $scope.state = $state;

        $scope.previousState = function () {
                $scope.valid = true;
                $state.go(navigationService.getPreviousState().id);
        };

        // Flag indicating the validity of the form
        $scope.valid = true;

        // Check the validity of the form
        $scope.validate = function() {
            if ($state.current.validate) {
                $scope.$broadcast('validate-' + $state.current.id);
            }
            return $scope.valid;
        };

        // Listens on 'validation-response' event, dispatched by descendant controller
        $scope.$on('validation-response', function(event, data) {
            $scope.valid = data;
            event.stopPropagation();
        });

        $scope.endsWith = function(str, suffix) {
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        };

        $scope.goToStart = function() {
            $scope.goToAction($state.current.type);
        };

        $scope.goToBackup = function() {
            $state.go('root.create-backup-uninstall');
        };

        $scope.goToAction = function(action) {
            if (['install', 'upgrade', 'update'].indexOf(action) !== -1) {
                $state.go('root.' + action);
            } else if (action === 'uninstall') {
                $state.go('root.extension');
            } else {
                $state.go('root.module');
            }
        };
    }
])
.service('navigationService', ['$location', '$state', '$http', '$localStorage',
    function ($location, $state, $http, $localStorage) {
    return {
        mainState: {},
        states: [],
        titlesWithModuleName: ['enable', 'disable', 'update', 'uninstall'],
        load: function () {
            var self = this;
            return $http.get('index.php/navigation').success(function (data) {
                var currentState = $location.path().replace('/', '');
                var isCurrentStateFound = false;
                self.states = data.nav;
                $localStorage.menu = data.menu;
                self.titlesWithModuleName.forEach(function (value) {
                    data.titles[value] = data.titles[value] + $localStorage.moduleName;
                });
                $localStorage.titles = data.titles;
                data.nav.forEach(function (item) {
                    app.stateProvider.state(item.id, item);
                    if (item.default) {
                        self.mainState = item;
                    }

                    if (currentState == item.url) {
                        $state.go(item.id);
                        isCurrentStateFound = true;
                    }
                });
                if (!isCurrentStateFound) {
                    $state.go(self.mainState.id);
                }
            });
        },
        getNextState: function () {
            var nItem = {};
            this.states.forEach(function (item) {
                if (item.order == $state.$current.order + 1 && item.type == $state.$current.type) {
                    nItem = item;
                }
            });
            return nItem;
        },
        getPreviousState: function () {
            var nItem = {};
            this.states.forEach(function (item) {
                if (item.order == $state.$current.order - 1 && item.type == $state.$current.type) {
                    nItem = item;
                }
            });
            return nItem;
        }
    };
}])
.service('authService', ['$localStorage', '$rootScope', '$state', '$http', 'ngDialog',
    function ($localStorage, $rootScope, $state, $http, ngDialog) {
        return {
            checkMarketplaceAuthorized: function() {
                $rootScope.isMarketplaceAuthorized = typeof $rootScope.isMarketplaceAuthorized !== 'undefined'
                    ? $rootScope.isMarketplaceAuthorized : false;
                if ($rootScope.isMarketplaceAuthorized == false) {
                    this.goToAuthPage();
                }
            },
            goToAuthPage: function() {
                if ($state.current.type === 'upgrade') {
                    $state.go('root.upgrade');
                } else {
                    $state.go('root.extension-auth');
                }
            },
            reset: function (context) {
                return $http.post('index.php/marketplace/remove-credentials', [])
                    .success(function (response) {
                        if (response.success) {
                            $localStorage.isMarketplaceAuthorized = $rootScope.isMarketplaceAuthorized = false;
                            context.success();
                        }
                    })
                    .error(function (data) {
                    });
            },
            checkAuth: function(context) {
                return $http.post('index.php/marketplace/check-auth', [])
                    .success(function (response) {
                        if (response.success) {
                            $rootScope.isMarketplaceAuthorized  = $localStorage.isMarketplaceAuthorized = true;
                            $localStorage.marketplaceUsername = response.data.username;
                            context.success(response);
                        } else {
                            $rootScope.isMarketplaceAuthorized  = $localStorage.isMarketplaceAuthorized = false;
                            context.fail(response);
                        }
                    })
                    .error(function() {
                        $rootScope.isMarketplaceAuthorized = $localStorage.isMarketplaceAuthorized = false;
                        context.error();
                    });
            },
            openAuthDialog: function(scope) {
                return $http.get('index.php/marketplace/popup-auth').success(function (data) {
                    scope.isHiddenSpinner = true;
                    ngDialog.open({
                        scope: scope,
                        template: data,
                        plain: true,
                        showClose: false,
                        controller: 'authDialogController'
                    });
                });
            },
            closeAuthDialog: function() {
                return ngDialog.close();
            },
            saveAuthJson: function (context) {
                return $http.post('index.php/marketplace/save-auth-json', context.user)
                    .success(function (response) {
                        $rootScope.isMarketplaceAuthorized = $localStorage.isMarketplaceAuthorized = response.success;
                        $localStorage.marketplaceUsername = context.user.username;
                        if (response.success) {
                            context.success(response);
                        } else {
                            context.fail(response);
                        }
                    })
                    .error(function (data) {
                        $rootScope.isMarketplaceAuthorized = $localStorage.isMarketplaceAuthorized = false;
                        context.error(data);
                    });
            }
    };
    }]
)
.service('titleService', ['$localStorage', '$rootScope',
    function ($localStorage, $rootScope) {
        return {
            setTitle: function(type, moduleName) {
                $localStorage.moduleName = moduleName;
                if (typeof $localStorage.titles === 'undefined') {
                    $localStorage.titles = [];
                }
                $localStorage.titles[type] = type.charAt(0).toUpperCase() + type.slice(1) + ' '
                    + $localStorage.moduleName;
                $rootScope.titles = $localStorage.titles;
            }
        };
    }]
)
.service('paginationService', [
    function () {
        return {
            initWatchers: function ($scope) {
                $scope.$watch('currentPage + rowLimit', function () {
                    $scope.numberOfPages = Math.ceil($scope.total / $scope.rowLimit);
                    if ($scope.currentPage > $scope.numberOfPages) {
                        $scope.currentPage = $scope.numberOfPages;
                    }
                });
            }
        };
    }
])
.filter('startFrom', function () {
    return function (input, start) {
        if (input !== undefined && start !== 'NaN') {
            start = parseInt(start, 10);
            return input.slice(start);
        }
        return 0;
    };
});
