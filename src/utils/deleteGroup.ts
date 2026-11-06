import OBR from "@owlbear-rodeo/sdk";
import {
  getGroup,
  getGroupIcons,
  getGroupNames,
  getScene,
  GM_ASSIGNEE,
  metadataKeys,
  sceneMetadata,
  sceneMetadataKeys,
  UNASSIGNED_GROUP_ID,
} from "./metadata";
import { removeGroupFromScene } from "./structuredScene";

export async function deleteGroup(groupId: number): Promise<void> {
  const metadata = await OBR.scene.getMetadata();
  const scene = getScene(metadata);
  if (
    groupId === UNASSIGNED_GROUP_ID ||
    scene.deletedGroups.includes(groupId)
  ) {
    throw new Error("This group cannot be deleted.");
  }

  const items = await OBR.scene.items.getItems();
  const memberIds = items
    .filter((item) => item.layer === "CHARACTER" && getGroup(item) === groupId)
    .map((item) => item.id);
  if (memberIds.length > 0) {
    await OBR.scene.items.updateItems(memberIds, (members) => {
      for (const member of members) {
        if (getGroup(member) === groupId) {
          member.metadata = {
            ...member.metadata,
            [metadataKeys.group]: UNASSIGNED_GROUP_ID,
            [metadataKeys.assignment]: GM_ASSIGNEE,
          };
        }
      }
    });
  }

  const groupNames = { ...getGroupNames(metadata) };
  const groupIcons = { ...getGroupIcons(metadata) };
  delete groupNames[groupId];
  delete groupIcons[groupId];
  await OBR.scene.setMetadata({
    ...sceneMetadata(removeGroupFromScene(scene, groupId)),
    [sceneMetadataKeys.groupNames]: groupNames,
    [sceneMetadataKeys.groupIcons]: groupIcons,
  });
}
