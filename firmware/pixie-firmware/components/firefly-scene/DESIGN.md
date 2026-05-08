Scene Graph Design
==================

A **Scene** is organized as a collection of **Nodes** connected
hierarchially in a tree structure.

To display a **Scene** it is first *seqeuenced*, creating a
point-in-time snapshot as a **RenderList**. When the sequencing
begins, the **RenderList** is cleared then the scene is
traversed from the root node, depth-first, giving each node an
opportunity to append **RenderNodes** to the **RenderList**.

Once sequenced, the **RenderList** can  then be rendered to any
viewport. When used with `firefly-display`, the scene is rendered
multiple times, once to each fragment while the screen is updated.

This allows a two-buffer system, one for blitting via DMA while
the other is rendered to via the CPU processing the **RenderList**.
After both blitting and processing the **RenderList** is complete,
the two buffers are swapped and the process begins for the next
fragment.

This document covers the structure implementation details. The
implementation aims to be as light as possible on memory and
remain efficient for use on embedded devices.

## Objects

### Scene

The **Scene** is the main class that manages an entire scene,
including a pool of **FreeNodes** (i.e. the *FreeList*),
the sequenced **RenderNodes** (i.e. the *RenderList**),
the actual scene **SequenceNodes** which represent the
hierarcal **Nodes** and updates by the **AnimationNodes**
running on **SequenceNodes**.

**Properties:**

- `nextFree` - the head of the FreeList
- `root` - the root *GroupNode*, created during init
- `tick` - the global scene timestamp
- `renderHead` - the head of the *RenderList*
- `renderTail` - the tail of the *RenderList*

### Node

**Properties:**

The node properties are highly overloaded depending on the type of
**Node**, but this outlines the general usage of each:

- `nextNode`
  - FreeNode: pointer to next FreeNode in the FreeList
  - SequenceNode: pointer to next sibling SequenceNode
  - RenderNode: pointer to the next RenderNode in the RenderList
  - AnimationNode: pointer to the AnimationPropertyNode for the animation
  - AnimationPropertyNode: pointer to the next AnimationNode (NULL if tail)
- `animate`
  - SequenceNode: the head of the AnimationNode linked list for the node animations
  - AnimationProperyNode: the `onComplete` (if any) for the animation to call when complere
- `func`
  - SequenceNode: the sequence function that adds **Render Nodes** to the render list
  - RenderNode: the render function that renders the node to the buffer
  - AnimateNode: the function to perform interpolation between the start and end values of the animation
  - AnimationPropertyNode: the animation curve for the property
- `pos`
  - SequenceNode: the relative position with respect to the parent
  - RenderNode: the world position of the node (rendering is flat, non-hierarchal)
  - AnimateNode: the y coordinate stores the pending StopType if the animations have been stopped
- `a`
  - SequenceNode: node-specific property
  - GroupNode: pointer to first child
  - RenderNode: usually a snapshot of the related sequence node `.a` when sequenced
  - AnimationNode: the animation duration
  - AnimationProperyNode: the start value of the property to interpolate
- `b`
  - SequenceNode: node-specific property
  - GroupNode: pointer to last child
  - RenderNode: usually a snapshot of the related sequence node `.b` when sequenced
  - AnimationNode: the animation end time
  - AnimationProperyNode: the end value of the property to interpolate


### FreeList

The pool of available **FreeNodes** is managed as linked list.

Since the **RenderList** is also managed as a linked list,
to recycle the entire current sequence **RenderList** it can
be trivially joined to the head ot the **FreeList**.

An **AnimationList**, however, only stores its head, so it
must be added one **Node** at a time. In the future this
could be mitigated by storing the tail, possibly in the
**AnimateNode** `.animate` property.


### RenderList

The **RenderList** is managed as a linked list, where each
**RenderNode** has its position in world coordinates,
since all hierarchal relationships have been flattened.

It is created by the `ffx_scene_sequence`, which traverses the entire
scene graph, providing each **SequenceNode** the opportunity to add
zero or more **RenderNodes** to the **RenderList**.

When the `ffx_scene_render` is called, the **RenderList** is
followed from head to tail, providing a *RenderFunc* the opportunity
to update the pixels in the viewport.

Rendering does not affect the **RenderList**, soit can be called
repeatedly to populate multiple viewports, which is used by
`firefly-display` to render the full screen as a series of fragments.


### AnimationList

The animations attached to a **SequenceNode** are stored as a linked
list with the most recent animation added to the head. Each entry in
the AnimationList is a pair of Nodes; an AnimationNode and a PropertyNode.

When the animations on a SequenceNode are stopped, the head is marked
as stopped (along with the stop type).

During the `ffx_scene_sequence` all animations are performed in the
order of the AnimationList. If an animation has stopped (either due
to completion or being marked as stopped) the pair of nodes is added
to the FreeList.

Since the most recent animation is added to the head, adding a new
animation after stopping animations works as expected.


## Node Types


### FreeNode

A **FreeNode** is an unallocated Node which can be used for any Node
type, stored in the FreeList.

When the **Scene** is initialized all the Nodes are linked
together and the `Scene.freeNode` points to the head.


### SequenceNode

Each **Sequence Node** represents a node in the Scene Graph.

Some may represent a renderable node (such as an image or box)
while others may merely represent relationships via a group
node.

When a sequence node is sequenced (via `ffx_scene_sequence`)
the node may add 0 or more **Render Nodes*.


### RenderNode

A RenderNode represents an action which is required during
the `ffx_scene_renderFragment` and is is called for each
fragment to render the viewport.

The RenderList is completely recycled at the beginning
of `ffx_scene_sequence`, and the SequenceNode `.func` is
responsible for adding any RenderNode(s) necessary.

Since the RenderList is flat (i.e. non-hierarchal) all
positions are automatically adjusted to world coordinates
and the sequence function should take a snapshot of the
current values, as updates outside a sequence must not
affect rendering.

Some sequencing and rendering functions may adjust the
RenderNode `.pos`, `.a` and `.b` to optimize and cache
calculations.

For example, the BoxNode creates its RenderNode clipped to
the display, so the RenderNode is unaware of the actual
position and size of the cooresponding SequenceNode.


### AnimationNode

An AnimationNode is paired with a AnimationPropertyNode which
contains all the necessary properties required to animate a
node.

The AnimationNode includes the timing information for the
animation as well as the animation function used to interpolate
between the start and end values.

The AnimationPropertyNode includes the start and end values
for the property being animated as well as the curve function
used to interpolate the parametric t.

Animations are added to the head of a SequenceNode
AnimationList. When an animation is stopped, the head of
the SequenceNode's AnimationList is stopped, which will
get picked up on the next sequence. Any additional animations
added will be placed in front of the stopped animation and
therefore unaffected by the pending stop.


### AnimationPropertyNode

See the AnimationNode for more details.


## Notes

### Removing nodes

A SequenceNode is not immediately removed, instead the `.func`
is set to a special sequence function that is never called; it
is intercepted during graph traversal.

During traversal the node is reclaimated and moved to the
FreeList, allowing proper clean-up, including all child
nodes and animations.
