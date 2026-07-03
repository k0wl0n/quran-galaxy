import type { Topic } from './types'

export interface TopicHierarchy {
  allTopics: Topic[]
  leafTopics: Topic[]
  clusters: Topic[]
  byId: Map<string, Topic>
  childrenByParent: Map<string, Topic[]>
  parentByChild: Map<string, string>
}

export function topicKind(topic: Topic): 'cluster' | 'topic' {
  return topic.kind === 'cluster' ? 'cluster' : 'topic'
}

export function isCluster(topic: Topic | undefined): topic is Topic {
  return !!topic && topicKind(topic) === 'cluster'
}

export function isLeafTopic(topic: Topic | undefined): topic is Topic {
  return !!topic && topicKind(topic) === 'topic'
}

export function createTopicHierarchy(topics: Topic[]): TopicHierarchy {
  const byId = new Map(topics.map((topic) => [topic.id, topic]))
  const childrenByParent = new Map<string, Topic[]>()
  const parentByChild = new Map<string, string>()

  topics.forEach((topic) => {
    if (topic.parent_id && byId.has(topic.parent_id)) {
      const siblings = childrenByParent.get(topic.parent_id) ?? []
      siblings.push(topic)
      childrenByParent.set(topic.parent_id, siblings)
      parentByChild.set(topic.id, topic.parent_id)
    }
  })

  topics.forEach((topic) => {
    if (!isCluster(topic)) return
    const explicitChildren = (topic.child_topic_ids ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is Topic => !!child && child.id !== topic.id)
    if (!explicitChildren.length) return
    const existing = childrenByParent.get(topic.id) ?? []
    const merged = [...existing]
    explicitChildren.forEach((child) => {
      if (!merged.some((item) => item.id === child.id)) merged.push(child)
      parentByChild.set(child.id, topic.id)
    })
    childrenByParent.set(topic.id, merged)
  })

  const clusters = topics.filter(isCluster)
  const leafTopics = topics.filter(isLeafTopic)

  return { allTopics: topics, leafTopics, clusters, byId, childrenByParent, parentByChild }
}

export const DEFAULT_VISIBLE_TOPIC_LIMIT = 400

export function getDefaultVisibleTopics(hierarchy: TopicHierarchy): Topic[] {
  if (!hierarchy.clusters.length) return hierarchy.allTopics.slice(0, DEFAULT_VISIBLE_TOPIC_LIMIT)
  return hierarchy.leafTopics.slice(0, DEFAULT_VISIBLE_TOPIC_LIMIT)
}

export function getVisibleTopics(hierarchy: TopicHierarchy, expandedClusterId: string | null): Topic[] {
  if (!hierarchy.clusters.length) return hierarchy.allTopics
  if (!expandedClusterId) return getDefaultVisibleTopics(hierarchy)

  const expandedCluster = hierarchy.byId.get(expandedClusterId)
  if (!isCluster(expandedCluster)) return getDefaultVisibleTopics(hierarchy)

  const children = hierarchy.childrenByParent.get(expandedClusterId) ?? []
  if (!children.length) return getDefaultVisibleTopics(hierarchy)

  const otherClusters = hierarchy.clusters.filter((topic) => topic.id !== expandedClusterId)
  return [expandedCluster, ...children, ...otherClusters]
}

export function parentClusterIdFor(hierarchy: TopicHierarchy, topicId: string): string | null {
  return hierarchy.parentByChild.get(topicId) ?? null
}
