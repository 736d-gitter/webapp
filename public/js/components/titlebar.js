define([
  'jquery',
  'utils/appevents'
], function($, appEvents) {
  "use strict";

  function updateLeftMenuBadge(unreadCount) {
    $('.unread-count').text(unreadCount);
  }

  function updateFavicon(unreadCount) {
    var image = (unreadCount > 0) ? '/images/gitter/favicon-unread.ico' : '/images/2/gitter/favicon-read.ico';
    $('#favicon').attr('href', image);
  }

  // ➀,➁,➂,➃,➄,➅,➆,➇,➈,➉,[11],[12]...
  function getClearCircleNumber(number) {
    if(number > 0 && number <= 10) {
      return String.fromCharCode(0x277F + number);
    } else {
      return '['+number+']';
    }
  }

  // ➊,➋,➌,➍,➎,➏,➐,➑,➒,➓,[11],[12]...
  function getSolidCircleNumber(number) {
    if(number > 0 && number <= 10) {
      return String.fromCharCode(0x2789 + number);
    } else {
      return '['+number+']';
    }
  }

  function TitlebarUpdater() {
    var self = this;
    this._unreadRoomCount = 0;
    this._isUnreadInRoom = false;
    this._roomName = '';
    this._roomNameNotInitialised = true;

    appEvents.on('troupeUnreadTotalChange', function(values) {
      self.setUnread(values.overall, !!values.current);

      var unreadCount = values.overall;
      updateLeftMenuBadge(unreadCount);
      updateFavicon(unreadCount);
    });
  }

  TitlebarUpdater.prototype.setUnread = function(roomCount, isUnreadInRoom) {
    this._unreadRoomCount = roomCount;
    this._isUnreadInRoom = isUnreadInRoom;
    this._render();
  };

  TitlebarUpdater.prototype.setRoomName = function(roomName) {
    this._roomNameNotInitialised = false;
    this._roomName = roomName;
    this._render();
  };

  TitlebarUpdater.prototype._render = function() {
    if(this._roomNameNotInitialised) {
      return;
    }

    var title = (this._roomName) ? this._roomName +' - Gitter' : 'Gitter';

    if(this._unreadRoomCount > 0) {
      if(this._isUnreadInRoom) {
        title = getSolidCircleNumber(this._unreadRoomCount) + ' ' + title;
      } else {
        title = getClearCircleNumber(this._unreadRoomCount) + ' ' + title;
      }
    }

    document.title = title;
  };

  return TitlebarUpdater;
});
