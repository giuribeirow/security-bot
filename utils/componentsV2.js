const COMPONENT_TYPES = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  USER_SELECT: 5,
  ROLE_SELECT: 6,
  MENTIONABLE_SELECT: 7,
  CHANNEL_SELECT: 8,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  FILE: 13,
  SEPARATOR: 14,
  CONTAINER: 17
};

const IS_COMPONENTS_V2 = 32768;

function button(customId, label, style = 2, disabled = false) {
  return {
    type: COMPONENT_TYPES.BUTTON,
    custom_id: customId,
    label,
    style,
    disabled
  };
}

function text(content) {
  return { type: COMPONENT_TYPES.TEXT_DISPLAY, content };
}

function separator() {
  return { type: COMPONENT_TYPES.SEPARATOR, spacing: 1, divider: true };
}

function row(components) {
  return { type: COMPONENT_TYPES.ACTION_ROW, components };
}

function container(components) {
  return { type: COMPONENT_TYPES.CONTAINER, components };
}

function createTextContainer(title, description, accessories = []) {
  const components = [text(`### ${title}\n${description}`)];
  let currentButtons = null;

  for (const accessory of accessories) {
    const selectTypes = [
      COMPONENT_TYPES.STRING_SELECT,
      COMPONENT_TYPES.USER_SELECT,
      COMPONENT_TYPES.ROLE_SELECT,
      COMPONENT_TYPES.MENTIONABLE_SELECT,
      COMPONENT_TYPES.CHANNEL_SELECT
    ];
    if (accessory.type === COMPONENT_TYPES.BUTTON) {
      if (!currentButtons || currentButtons.components.length >= 5) {
        currentButtons = row([]);
        components.push(currentButtons);
      }
      currentButtons.components.push(accessory);
      continue;
    }
    if (selectTypes.includes(accessory.type)) {
      components.push(row([accessory]));
      currentButtons = null;
    }
  }

  return container(components);
}

module.exports = {
  COMPONENT_TYPES,
  IS_COMPONENTS_V2,
  button,
  container,
  createTextContainer,
  row,
  separator,
  text
};
