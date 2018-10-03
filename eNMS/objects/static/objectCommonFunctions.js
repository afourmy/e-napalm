/*
global
alertify: false
fields: false
partial: false
table: false
*/

(function() {
  $('#authentication').change(function() {
    $('#user-credentials,#device-credentials').prop(
      'disabled', !$(this). prop('checked')
    );
  });
})();

/**
 * Display object modal for editing.
 * @param {type} type - Node or link.
 * @param {id} id - Id of the object to edit.
 */
function showObjectModal(type, id) { // eslint-disable-line no-unused-vars
  $('#title').text(`Edit ${type} properties`);
  $.ajax({
    type: 'POST',
    url: `/objects/get/${type}/${id}`,
    success: function(properties) {
      for (const [property, value] of Object.entries(properties)) {
        $(`#${type}-${property}`).val(value);
      }
      $('#connection-parameters-button').unbind('click');
      $('#connection-parameters-button').click(
        partial(connectionParametersModal, id)
      );
    },
  });
  if (type == 'device') {
    $.ajax({
      type: 'POST',
      url: `/views/get_logs_${id}`,
      success: function(logs) {
        $('#logs').text(logs);
      },
    });
  }
  $(`#edit-${type}`).modal('show');
}

/**
 * Edit object.
 * @param {type} type - Node or link.
 */
function editObject(type) { // eslint-disable-line no-unused-vars
  if ($(`#edit-${type}-form`).parsley().validate()) {
    $.ajax({
      type: 'POST',
      url: '/objects/edit_object',
      dataType: 'json',
      data: $(`#edit-${type}-form`).serialize(),
      success: function(properties) {
        const mode = $('#title').text().startsWith('Edit') ? 'edit' : 'add';
        // the object can be edited from the views,
        // in which case we don't need to add it to the table
        if (typeof table !== 'undefined') {
          addObjectToTable(mode, type, properties);
        }
        const message = `Object ${properties.name}
        ${mode == 'edit' ? 'edited' : 'created'}.`;
        alertify.notify(message, 'success', 5);
      },
    });
    $(`#edit-${type}`).modal('hide');
  }
}

/**
 * Delete object.
 * @param {type} type - Node or link.
 * @param {id} id - Id of the object to delete.
 */
function deleteObject(type, id) { // eslint-disable-line no-unused-vars
  $.ajax({
    type: 'POST',
    url: `/objects/delete/${type}/${id}`,
    success: function(properties) {
      table.row($(`#${type}-${id}`)).remove().draw(false);
      alertify.notify(
        `Object '${properties.name}' successfully deleted.`,
        'error', 5
    );
    },
  });
}

/**
 * Add object to the datatable.
 * @param {mode} mode - Create or edit.
 * @param {type} type - Device or link.
 * @param {properties} properties - Properties of the object.
 */
function addObjectToTable(mode, type, properties) {
  let values = [];
  for (let i = 0; i < fields.length; i++) {
    if (['longitude', 'latitude'].includes(fields[i])) {
      values.push(`${parseFloat(properties[fields[i]]).toFixed(2)}`);
    } else {
      values.push(`${properties[fields[i]]}`);
    }
  }

  // if it is a device, we add the "Connect" button.
  if (type == 'device') {
    values.push(`<button type="button" class="btn btn-success btn-xs"
    onclick="connectionParametersModal('${properties.id}')">Connect</button>`);
  }
  values.push(
    `<button type="button" class="btn btn-info btn-xs"
    onclick="showObjectModal('${type}', '${properties.id}')">Edit</button>`,
    `<button type="button" class="btn btn-danger btn-xs"
    onclick="deleteObject('${type}', '${properties.id}')">Delete</button>`
  );
  if (mode == 'edit') {
    table.row($(`#${type}-${properties.id}`)).data(values);
  } else {
    const rowNode = table.row.add(values).draw(false).node();
    $(rowNode).attr('id', `${type}-${properties.id}`);
  }
}

/**
 * Display the object modal.
 * @param {type} type - Node or link.
 */
function showObjectTypeModal(type) { // eslint-disable-line no-unused-vars
  $('#title').text(`Add a new ${type}`);
  $(`#edit-${type}-form`).trigger('reset');
  $(`#edit-${type}`).modal('show');
}

/**
 * Import topology.
 * @param {objType} objType - Type of object.
 */
function importTopology(objType) { // eslint-disable-line no-unused-vars
  if ($('#import-form').parsley().validate() ) {
    const formData = new FormData($('#import-form')[0]);
    $.ajax({
      type: 'POST',
      url: '/objects/import_topology',
      dataType: 'json',
      data: formData,
      contentType: false,
      processData: false,
      async: false,
      success: function(objects) {
        for (let i = 0; i < objects[objType].length; i++) {
          const obj = objects[objType][i];
          // const mode = $(`#${objType}-${obj.id}`).length ? 'create' : 'edit';
          addObjectToTable('create', objType.toLowerCase(), obj);
        }
        alertify.notify('Topology successfully imported.', 'success', 5);
      },
    });
  }
}

/**
 * Open new tab at the provided URL.
 * @param {url} url - URL.
 */
function openUrl(url) {
  let win = window.open(url, '_blank');
  win.focus();
}

/**
 * Display the device connection modal.
 * @param {id} id - Device id.
 */
function connectionParametersModal(id) { // eslint-disable-line no-unused-vars
  $('#connection-button').unbind('click');
  $('#connection-button').click(partial(sshConnection, id));
  $('#connection-parameters-form').trigger('reset');
  $('#edit-device').modal('hide');
  $('#connection-parameters').modal('show');
}

/**
 * Start an SSH session to the device.
 * @param {id} id - Device id.
 */
function sshConnection(id) { // eslint-disable-line no-unused-vars
  $.ajax({
    type: 'POST',
    url: `/objects/connection/${id}`,
    dataType: 'json',
    data: $('#connection-parameters-form').serialize(),
    success: function(result) {
      let url = result.server_addr;
      if (!url) {
        url = `${window.location.protocol}//${window.location.hostname}`;
      }
      terminal = result.redirection
        ? `${url}/terminal${result.port}/`
        : `${url}:${result.port}`;
      setTimeout(function() {
        openUrl(terminal);
      }, 300);
      const link = `Click here to connect to ${result.device}.`
      const messageLink = `<a target='_blank' href='${terminal}'>${link}</a>`;
      alertify.notify(messageLink, 'success', 15);
      const warning = `Don't forget to turn off the pop-up blocker !`
      alertify.notify(warning, 'error', 20);
      $('#connection-parameters').modal('hide');
    },
  });
}

